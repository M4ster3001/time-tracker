import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { BadRequestError, ForbiddenError } from '../../../app/errors/app-error.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import {
  assertReferenceNotActualTracked,
  buildEstimationReferenceKey,
  type EstimationReferenceKind,
} from '../domain/estimation-reference.js';
import {
  computeEvidenceContentFingerprint,
  nextEvidenceVersion,
  shouldCreateEvidenceVersion,
} from '../domain/estimation-reference-version.js';
import {
  pickEstimationReferenceAuthorUserId,
  resolveGitAuthorUserId,
  type GitAuthorMapping,
} from '../domain/git-author-map.js';

const resolveAuthorUserIdForReference = async (input: {
  actorUserId: number;
  gitAuthorEmail?: string | null;
  /** Mapas verified persistidos (vazio ate CRUD/org map existir). */
  mappings?: GitAuthorMapping[];
}): Promise<number | null> => {
  const gitEmail = String(input.gitAuthorEmail ?? '').trim();
  if (!gitEmail) {
    return pickEstimationReferenceAuthorUserId({
      hasGitAuthorIdentity: false,
      resolved: { status: 'unmapped' },
      fallbackActorUserId: input.actorUserId,
    });
  }
  const actor = await prisma.user.findUnique({
    where: { id: input.actorUserId },
    select: { email: true },
  });
  const resolved = resolveGitAuthorUserId({
    gitEmail,
    actorUserId: input.actorUserId,
    actorEmail: actor?.email ?? null,
    mappings: input.mappings ?? [],
  });
  return pickEstimationReferenceAuthorUserId({
    hasGitAuthorIdentity: true,
    resolved,
    fallbackActorUserId: input.actorUserId,
  });
};

export const linkEstimationReference = async (input: {
  actorUserId: number;
  provider: string;
  kind: EstimationReferenceKind;
  externalId: string;
  repository?: string | null;
  title?: string | null;
  uri?: string | null;
  timeEntryId?: number | null;
  projectId?: number | null;
  /** E-mail do autor Git (local-git / coletor); exige mapa ou self-claim. */
  gitAuthorEmail?: string | null;
  /** Mapas verified opcionais (injetaveis; default vazio). */
  gitAuthorMappings?: GitAuthorMapping[];
  /** Sempre false: evidencia nunca vira Actual Tracked. */
  presentAsActualTracked?: boolean;
}) => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  try {
    assertReferenceNotActualTracked({
      kind: input.kind,
      presentAsActualTracked: input.presentAsActualTracked === true,
    });
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  const dedupeKey = buildEstimationReferenceKey({
    provider: input.provider,
    kind: input.kind,
    externalId: input.externalId,
    repository: input.repository,
  });
  const provider = input.provider.trim().toLowerCase();
  const externalId = input.externalId.trim();
  const repository = input.repository?.trim() || null;
  const title = input.title ?? null;
  const uri = input.uri ?? null;
  const fingerprint = computeEvidenceContentFingerprint({ title, uri });
  const authorUserId = await resolveAuthorUserIdForReference({
    actorUserId: input.actorUserId,
    gitAuthorEmail: input.gitAuthorEmail,
    mappings: input.gitAuthorMappings,
  });

  const existing = await prisma.estimationReference.findMany({
    where: { dedupeKey },
    orderBy: { evidenceVersion: 'desc' },
  });
  const latest = existing[0] ?? null;

  if (!latest) {
    return prisma.estimationReference.create({
      data: {
        provider,
        kind: input.kind,
        externalId,
        repository,
        dedupeKey,
        evidenceVersion: 1,
        contentFingerprint: fingerprint,
        title,
        uri,
        timeEntryId: input.timeEntryId ?? null,
        projectId: input.projectId ?? null,
        authorUserId,
      },
    });
  }

  if (
    shouldCreateEvidenceVersion({
      existingFingerprint: latest.contentFingerprint,
      nextFingerprint: fingerprint,
    })
  ) {
    return prisma.estimationReference.create({
      data: {
        provider,
        kind: input.kind,
        externalId,
        repository,
        dedupeKey,
        evidenceVersion: nextEvidenceVersion(existing.map((row) => row.evidenceVersion)),
        contentFingerprint: fingerprint,
        previousReferenceId: latest.id,
        title,
        uri,
        timeEntryId: input.timeEntryId ?? null,
        projectId: input.projectId ?? null,
        authorUserId,
      },
    });
  }

  // Mesmo conteudo: atualiza so vinculos; nao reescreve title/uri do historico.
  return prisma.estimationReference.update({
    where: { id: latest.id },
    data: {
      timeEntryId: input.timeEntryId ?? undefined,
      projectId: input.projectId ?? undefined,
      contentFingerprint: latest.contentFingerprint ?? fingerprint,
      ...(authorUserId != null && latest.authorUserId == null
        ? { authorUserId }
        : {}),
    },
  });
};
