import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../app/errors/app-error.js';
import {
  assertProjectBelongsToClient,
  assertProjectCode,
  assertProjectTransition,
  type ProjectState,
  PROJECT_STATES,
} from '../domain/project.rules.js';

export type CreateProjectInput = {
  clientId: number;
  code: string;
  name: string;
  description?: string | null;
  state?: ProjectState;
  ownerUserId?: number | null;
};

const isProjectState = (value: unknown): value is ProjectState =>
  typeof value === 'string' && PROJECT_STATES.includes(value as ProjectState);

export const listProjectsForClient = async (clientId: number) => {
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    throw new BadRequestError('Invalid clientId');
  }
  return prisma.project.findMany({
    where: { clientId },
    orderBy: [{ state: 'asc' }, { name: 'asc' }],
  });
};

const asBadRequest = (error: unknown): never => {
  if (error instanceof Error) throw new BadRequestError(error.message);
  throw error;
};

export const createProject = async (input: CreateProjectInput) => {
  const code = (() => {
    try {
      return assertProjectCode(input.code);
    } catch (error) {
      return asBadRequest(error);
    }
  })();
  const name = input.name?.trim();
  if (!name) throw new BadRequestError('PROJECT_NAME_REQUIRED');
  if (!Number.isSafeInteger(input.clientId) || input.clientId <= 0) {
    throw new BadRequestError('Invalid clientId');
  }

  const client = await prisma.client.findFirst({
    where: { id: input.clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) throw new NotFoundError('Client not found');

  const state: ProjectState = input.state ?? 'ACTIVE';
  if (!isProjectState(state)) throw new BadRequestError('Invalid project state');

  try {
    return await prisma.project.create({
      data: {
        clientId: input.clientId,
        code,
        name,
        description: input.description?.trim() || null,
        state,
        ownerUserId: input.ownerUserId ?? null,
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new ConflictError('PROJECT_CODE_DUPLICATE');
    }
    throw error;
  }
};

export type UpdateProjectInput = {
  name?: string;
  description?: string | null;
  state?: ProjectState;
  ownerUserId?: number | null;
};

export const updateProject = async (projectId: number, input: UpdateProjectInput) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError('Project not found');

  const data: {
    name?: string;
    description?: string | null;
    state?: ProjectState;
    ownerUserId?: number | null;
  } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new BadRequestError('PROJECT_NAME_REQUIRED');
    data.name = name;
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }
  if (input.state !== undefined) {
    if (!isProjectState(input.state)) throw new BadRequestError('Invalid project state');
    data.state = input.state;
  }
  if (input.ownerUserId !== undefined) {
    data.ownerUserId = input.ownerUserId;
  }
  if (Object.keys(data).length === 0) throw new BadRequestError('No fields to update');

  return prisma.project.update({ where: { id: projectId }, data });
};

export const archiveProject = async (projectId: number) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError('Project not found');
  return prisma.project.update({
    where: { id: projectId },
    data: { state: 'ARCHIVED' },
  });
};

/** Valida projeto opcional em lancamento; rejeita cliente cruzado e estado bloqueado. */
export const assertProjectUsableForEntry = async (input: {
  clientId: number;
  projectId: number | null | undefined;
  requireProject: boolean;
}): Promise<void> => {
  if (input.projectId == null) {
    if (input.requireProject) throw new BadRequestError('PROJECT_REQUIRED');
    return;
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { clientId: true, state: true },
  });
  if (!project) throw new NotFoundError('Project not found');

  try {
    assertProjectBelongsToClient({
      projectClientId: project.clientId,
      requestedClientId: input.clientId,
    });
  } catch (error) {
    asBadRequest(error);
  }

  if (!assertProjectTransition(project.state, 'canCreateTimeEntry')) {
    throw new ForbiddenError('PROJECT_NOT_ACCEPTING_ENTRIES');
  }
};
