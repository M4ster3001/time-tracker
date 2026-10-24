import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  selectParameterSetByPrecedence,
  type ParameterSetCandidate,
  type ParameterScopeContext,
} from '../domain/parameter-scope.js';

export type ResolvedCatalogParameters = {
  parameterSetId: number;
  scope: ParameterSetCandidate['scope'];
  clientId: number | null;
  projectId: number | null;
  parameterRevisionUuid: string;
  baseMinutes: number;
  factor: number;
};

const toCandidate = (set: {
  id: number;
  scope: string;
  clientId: number | null;
  projectId: number | null;
  isActive: boolean;
  revisions: Array<{
    uuid: string;
    baseMinutes: number;
    factor: { toString(): string } | number;
  }>;
}): ParameterSetCandidate | null => {
  const rev = set.revisions[0];
  if (!rev) return null;
  const factor =
    typeof rev.factor === 'number' ? rev.factor : Number(rev.factor.toString());
  if (!Number.isFinite(factor)) return null;
  if (set.scope !== 'GLOBAL' && set.scope !== 'CLIENT' && set.scope !== 'PROJECT') {
    return null;
  }
  return {
    id: set.id,
    scope: set.scope,
    clientId: set.clientId,
    projectId: set.projectId,
    isActive: set.isActive,
    revisionUuid: rev.uuid,
    baseMinutes: rev.baseMinutes,
    factor,
  };
};

/** Carrega sets ativos do tipo e aplica precedência projeto > cliente > global. */
export const resolveActiveCatalogParameters = async (input: {
  taskTypeId?: number | null;
  taskTypeCode?: string | null;
  context: ParameterScopeContext;
}): Promise<ResolvedCatalogParameters | null> => {
  const taskType =
    input.taskTypeId != null
      ? await prisma.taskType.findUnique({
          where: { id: input.taskTypeId },
          include: {
            parameterSets: {
              where: { isActive: true },
              include: {
                revisions: {
                  where: { effectiveTo: null },
                  orderBy: { effectiveFrom: 'desc' },
                  take: 1,
                },
              },
            },
          },
        })
      : input.taskTypeCode
        ? await prisma.taskType.findUnique({
            where: { code: input.taskTypeCode.trim().toUpperCase() },
            include: {
              parameterSets: {
                where: { isActive: true },
                include: {
                  revisions: {
                    where: { effectiveTo: null },
                    orderBy: { effectiveFrom: 'desc' },
                    take: 1,
                  },
                },
              },
            },
          })
        : null;

  if (!taskType) return null;

  const candidates = taskType.parameterSets
    .map(toCandidate)
    .filter((row): row is ParameterSetCandidate => row != null);

  const picked = selectParameterSetByPrecedence(candidates, input.context);
  if (!picked || !picked.revisionUuid) return null;

  return {
    parameterSetId: picked.id,
    scope: picked.scope,
    clientId: picked.clientId,
    projectId: picked.projectId,
    parameterRevisionUuid: picked.revisionUuid,
    baseMinutes: picked.baseMinutes,
    factor: picked.factor,
  };
};
