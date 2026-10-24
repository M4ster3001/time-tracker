import { ForbiddenError, BadRequestError } from '../../../app/errors/app-error.js';
import {
  getFlows,
  getUserGrants,
} from '../../access-control/application/access-control.service.js';
import { scopeFor } from '../../access-control/domain/permissions.js';
import { computeEstimatePreview, type RoundingMode } from '../../estimates/domain/estimate-preview.js';
import { linkEstimationReference } from '../../estimates/application/estimation-reference.service.js';
import { createEstimateRevisionForActivity } from '../../estimates/application/work-activity.service.js';
import type { EstimationReferenceKind } from '../../estimates/domain/estimation-reference.js';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  listMcpToolsForGrants,
  resolveMcpToolPermission,
} from '../domain/tool-catalog.js';

const REFERENCE_KINDS = new Set<string>([
  'COMMIT',
  'PULL_REQUEST',
  'ISSUE',
  'DOCUMENT',
  'MANUAL',
]);

export const listAuthorizedMcpTools = async (userId: number) => {
  const flows = await getFlows();
  if (!flows.mcp) throw new ForbiddenError('FLOW_DISABLED');
  const grants = await getUserGrants(userId);
  return listMcpToolsForGrants(grants, { mcp: flows.mcp, estimates: flows.estimates });
};

export const invokeMcpTool = async (input: {
  userId: number;
  toolName: string;
  arguments?: Record<string, unknown>;
}) => {
  const flows = await getFlows();
  if (!flows.mcp) throw new ForbiddenError('FLOW_DISABLED');

  const grants = await getUserGrants(input.userId);
  if (!scopeFor(grants, 'mcp.use')) throw new ForbiddenError('PERMISSION_DENIED');

  const permission = resolveMcpToolPermission(input.toolName);
  if (!permission) throw new ForbiddenError('MCP_TOOL_FORBIDDEN');
  if (!scopeFor(grants, permission)) throw new ForbiddenError('PERMISSION_DENIED');

  const args = input.arguments ?? {};

  switch (input.toolName) {
    case 'clients.list': {
      const clients = await prisma.client.findMany({
        where: { deletedAt: null, isActive: true },
        select: { uuid: true, code: true, name: true },
        take: 100,
        orderBy: { name: 'asc' },
      });
      return { clients };
    }
    case 'projects.list': {
      const projects = await prisma.project.findMany({
        select: { uuid: true, code: true, name: true, clientId: true, state: true },
        take: 100,
        orderBy: { name: 'asc' },
      });
      return { projects };
    }
    case 'activities.get': {
      if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');
      const idRaw = args.id ?? args.workActivityId;
      const uuidRaw = args.uuid;
      if (idRaw == null && uuidRaw == null) {
        throw new BadRequestError('id or uuid required');
      }
      const activitySelect = {
        id: true,
        uuid: true,
        title: true,
        description: true,
        state: true,
        clientId: true,
        projectId: true,
        ownerUserId: true,
        version: true,
      } as const;
      const activity =
        uuidRaw != null
          ? await prisma.workActivity.findFirst({
              where: { uuid: String(uuidRaw) },
              select: activitySelect,
            })
          : await prisma.workActivity.findUnique({
              where: { id: Number(idRaw) },
              select: activitySelect,
            });
      if (!activity) throw new BadRequestError('ACTIVITY_NOT_FOUND');
      return {
        activity: {
          ...activity,
          actualTrackedDurationMinutes: null,
          note: 'Actual Tracked never inferred from activity metadata',
        },
      };
    }
    case 'time_entries.propose': {
      const date = String(args.date ?? '').trim();
      const clientId = Number(args.clientId);
      const durationMinutes = Number(args.durationMinutes ?? args.confirmedDurationMinutes);
      const activityDescription =
        args.activityDescription == null ? null : String(args.activityDescription).slice(0, 2000);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestError('Invalid date');
      if (!Number.isSafeInteger(clientId) || clientId <= 0) {
        throw new BadRequestError('Invalid clientId');
      }
      if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
        throw new BadRequestError('Invalid durationMinutes');
      }
      const proposal = {
        userId: input.userId,
        clientId,
        date,
        durationMinutes,
        activityDescription,
        projectId: args.projectId == null ? null : Number(args.projectId),
        workActivityId: args.workActivityId == null ? null : Number(args.workActivityId),
        estimatedDurationMinutes:
          args.estimatedDurationMinutes == null
            ? null
            : Number(args.estimatedDurationMinutes),
        source: 'MCP_PROPOSE',
        confirmed: false,
        created: false,
      };
      await prisma.auditLog.create({
        data: {
          userId: input.userId,
          endpoint: '/api/mcp/tools/call',
          action: 'MCP_TIME_ENTRY_PROPOSE',
          status: 'success',
          details: JSON.stringify({
            tool: input.toolName,
            proposal,
            note: 'proposal_only_not_recognized_entry',
          }).slice(0, 4000),
        },
      });
      return {
        proposal,
        confirmed: false,
        created: false,
        note: 'Human review required in portal before a recognized time entry exists',
      };
    }
    case 'time_entries.list': {
      const entries = await prisma.timeEntry.findMany({
        where: { userId: input.userId, deletedAt: null },
        select: {
          uuid: true,
          date: true,
          durationMinutes: true,
          estimatedDurationMinutes: true,
          confirmedDurationMinutes: true,
          actualTrackedDurationMinutes: true,
          activityDescription: true,
        },
        take: 50,
        orderBy: { date: 'desc' },
      });
      return { timeEntries: entries };
    }
    case 'estimation_parameters.list': {
      if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');
      const revisions = await prisma.estimationParameterRevision.findMany({
        take: 50,
        orderBy: { effectiveFrom: 'desc' },
        include: { parameterSet: { include: { taskType: true } } },
      });
      return {
        revisions: revisions.map((r) => ({
          uuid: r.uuid,
          taskTypeCode: r.parameterSet.taskType.code,
          baseMinutes: r.baseMinutes,
          factor: Number(r.factor),
          effectiveFrom: r.effectiveFrom,
        })),
      };
    }
    case 'estimates.preview': {
      if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');
      try {
        return computeEstimatePreview({
          baseMinutes: Number(args.baseMinutes),
          factor: Number(args.factor),
          roundingMode: (args.roundingMode as RoundingMode | undefined) ?? 'NEAREST_MINUTE',
        });
      } catch (error) {
        if (error instanceof Error) throw new BadRequestError(error.message);
        throw error;
      }
    }
    case 'estimates.create_proposal': {
      if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');
      const workActivityId =
        args.workActivityId == null ? null : Number(args.workActivityId);
      if (workActivityId != null && Number.isSafeInteger(workActivityId) && workActivityId > 0) {
        const persisted = await createEstimateRevisionForActivity({
          actorUserId: input.userId,
          workActivityId,
          baseMinutes: args.baseMinutes == null ? undefined : Number(args.baseMinutes),
          factor: args.factor == null ? undefined : Number(args.factor),
          origin: 'MCP',
          reason:
            args.reason == null
              ? 'MCP estimates.create_proposal'
              : String(args.reason).slice(0, 2000),
          syncEstimatedOnLinkedEntries: args.syncEstimatedOnLinkedEntries !== false,
        });
        return {
          proposal: {
            suggestedMinutes: persisted.revision.suggestedMinutes,
            baseMinutes: persisted.revision.baseMinutes,
            factor: Number(persisted.revision.factor),
          },
          revision: persisted.revision,
          mutatesCatalog: persisted.mutatesCatalog,
          syncedEntryCount: persisted.syncedEntryCount,
          confirmed: false,
          persisted: true,
        };
      }
      // Sem workActivityId: previa auditavel sem persistir revisao (nao confirma horas).
      const preview = computeEstimatePreview({
        baseMinutes: Number(args.baseMinutes),
        factor: Number(args.factor),
        roundingMode: (args.roundingMode as RoundingMode | undefined) ?? 'NEAREST_MINUTE',
      });
      await prisma.auditLog.create({
        data: {
          userId: input.userId,
          endpoint: '/api/mcp/tools/call',
          action: 'MCP_ESTIMATE_PROPOSAL',
          status: 'success',
          details: JSON.stringify({
            tool: input.toolName,
            preview,
            note: 'proposal_only_not_confirmed',
          }).slice(0, 4000),
        },
      });
      return { proposal: preview, confirmed: false, persisted: false };
    }
    case 'estimates.link_reference': {
      if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');
      const kind = String(args.kind ?? '').toUpperCase();
      if (!REFERENCE_KINDS.has(kind)) throw new BadRequestError('Invalid kind');
      const provider = String(args.provider ?? '').trim();
      const externalId = String(args.externalId ?? '').trim();
      if (!provider || !externalId) throw new BadRequestError('provider and externalId required');
      const reference = await linkEstimationReference({
        actorUserId: input.userId,
        provider,
        kind: kind as EstimationReferenceKind,
        externalId,
        repository: args.repository == null ? null : String(args.repository),
        title: args.title == null ? null : String(args.title).slice(0, 500),
        uri: args.uri == null ? null : String(args.uri).slice(0, 1000),
        timeEntryId: args.timeEntryId == null ? null : Number(args.timeEntryId),
        projectId: args.projectId == null ? null : Number(args.projectId),
        presentAsActualTracked: false,
      });
      return {
        reference,
        confirmed: false,
        isActualTracked: false,
        note: 'EstimationReference is evidence input only — not Actual Tracked Duration',
      };
    }
    default:
      throw new BadRequestError('MCP_TOOL_UNKNOWN');
  }
};
