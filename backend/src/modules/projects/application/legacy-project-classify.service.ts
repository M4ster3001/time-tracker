import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../../app/errors/app-error.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import { resolveLockDay } from '../../time-tracking/domain/policies/time-entry-lock.policy.js';
import {
  classifyLegacyEntryForProject,
  MAX_LEGACY_CLASSIFY_BATCH,
  partitionClassifyDecisions,
  type LegacyClassifyConflictReason,
  type LegacyClassifyDecision,
} from '../domain/legacy-project-classify.js';
import type { ProjectState } from '../domain/project.rules.js';

const assertProjectsFlow = async (): Promise<void> => {
  const flows = await getFlows();
  if (!flows.projects) throw new ForbiddenError('FLOW_DISABLED');
};

const loadTargetProject = async (projectId: number) => {
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    throw new BadRequestError('Invalid projectId');
  }
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, clientId: true, state: true, code: true, name: true },
  });
  if (!project) throw new NotFoundError('Project not found');
  return project;
};

const isClosedPeriodForEntry = async (
  clientId: number,
  date: Date
): Promise<boolean> => {
  const closed = await prisma.closingPeriod.findFirst({
    where: {
      clientId,
      startDate: { lte: date },
      endDate: { gte: date },
      OR: [{ publishedVersion: { gt: 0 } }, { state: 'REVIEW' }],
    },
    select: { id: true },
  });
  return Boolean(closed);
};

export type LegacyPreviewEntry = {
  id: number;
  userId: number;
  date: Date;
  activityDescription: string;
  durationMinutes: number;
  decision: 'eligible' | LegacyClassifyConflictReason;
};

export const previewLegacyEntriesWithoutProject = async (
  projectId: number,
  options: { limit?: number; now?: Date } = {}
): Promise<{
  projectId: number;
  clientId: number;
  projectCode: string;
  projectName: string;
  totalWithoutProject: number;
  entries: LegacyPreviewEntry[];
}> => {
  await assertProjectsFlow();
  const project = await loadTargetProject(projectId);
  const client = await prisma.client.findUnique({
    where: { id: project.clientId },
    select: { id: true, lockDay: true },
  });
  if (!client) throw new NotFoundError('Client not found');

  const limit = Math.min(
    Math.max(1, options.limit ?? 50),
    MAX_LEGACY_CLASSIFY_BATCH
  );
  const lockDay = resolveLockDay(client.lockDay);
  const now = options.now ?? new Date();

  const [rows, totalWithoutProject] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { clientId: project.clientId, projectId: null, deletedAt: null },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        userId: true,
        clientId: true,
        projectId: true,
        date: true,
        deletedAt: true,
        activityDescription: true,
        durationMinutes: true,
      },
    }),
    prisma.timeEntry.count({
      where: { clientId: project.clientId, projectId: null, deletedAt: null },
    }),
  ]);

  const entries: LegacyPreviewEntry[] = [];
  for (const row of rows) {
    const closed = await isClosedPeriodForEntry(row.clientId, row.date);
    const decision = classifyLegacyEntryForProject({
      entry: row,
      targetProject: {
        id: project.id,
        clientId: project.clientId,
        state: project.state as ProjectState,
      },
      lockDay,
      isClosedPeriod: closed,
      now,
    });
    entries.push({
      id: row.id,
      userId: row.userId,
      date: row.date,
      activityDescription: row.activityDescription,
      durationMinutes: row.durationMinutes,
      decision: decision.status === 'eligible' ? 'eligible' : decision.reason,
    });
  }

  return {
    projectId: project.id,
    clientId: project.clientId,
    projectCode: project.code,
    projectName: project.name,
    totalWithoutProject,
    entries,
  };
};

export const classifyLegacyEntriesForProject = async (input: {
  projectId: number;
  entryIds: number[];
  actorUserId: number;
  dryRun?: boolean;
  now?: Date;
}): Promise<{
  projectId: number;
  clientId: number;
  dryRun: boolean;
  assignedIds: number[];
  conflicts: Array<{ entryId: number; reason: LegacyClassifyConflictReason }>;
}> => {
  await assertProjectsFlow();
  const project = await loadTargetProject(input.projectId);
  const client = await prisma.client.findUnique({
    where: { id: project.clientId },
    select: { id: true, lockDay: true },
  });
  if (!client) throw new NotFoundError('Client not found');

  const uniqueIds = [...new Set(input.entryIds.map(Number))].filter(
    (id) => Number.isSafeInteger(id) && id > 0
  );
  if (uniqueIds.length === 0) throw new BadRequestError('entryIds required');
  if (uniqueIds.length > MAX_LEGACY_CLASSIFY_BATCH) {
    throw new BadRequestError('LEGACY_CLASSIFY_BATCH_TOO_LARGE');
  }

  const lockDay = resolveLockDay(client.lockDay);
  const now = input.now ?? new Date();
  const rows = await prisma.timeEntry.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      userId: true,
      clientId: true,
      projectId: true,
      date: true,
      deletedAt: true,
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  const decisions: LegacyClassifyDecision[] = [];
  for (const entryId of uniqueIds) {
    const entry = byId.get(entryId) ?? null;
    const closed =
      entry != null ? await isClosedPeriodForEntry(entry.clientId, entry.date) : false;
    decisions.push(
      classifyLegacyEntryForProject({
        entry,
        targetProject: {
          id: project.id,
          clientId: project.clientId,
          state: project.state as ProjectState,
        },
        lockDay,
        isClosedPeriod: closed,
        now,
        requestedEntryId: entryId,
      })
    );
  }

  const { eligibleIds, conflicts } = partitionClassifyDecisions(decisions);
  const dryRun = Boolean(input.dryRun);

  if (!dryRun && eligibleIds.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.timeEntry.updateMany({
        where: {
          id: { in: eligibleIds },
          clientId: project.clientId,
          projectId: null,
          deletedAt: null,
        },
        data: { projectId: project.id },
      });
      await tx.auditLog.create({
        data: {
          userId: input.actorUserId,
          endpoint: `/api/projects/${project.id}/classify-legacy-entries`,
          action: 'CLASSIFY_LEGACY_PROJECT',
          status: 'success',
          details: JSON.stringify({
            projectId: project.id,
            clientId: project.clientId,
            assignedIds: eligibleIds,
            conflicts,
          }).slice(0, 4000),
        },
      });
    });
  }

  return {
    projectId: project.id,
    clientId: project.clientId,
    dryRun,
    assignedIds: eligibleIds,
    conflicts,
  };
};
