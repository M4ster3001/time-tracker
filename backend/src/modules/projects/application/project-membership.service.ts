import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../../app/errors/app-error.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import {
  assertProjectMembershipRole,
  type ProjectMembershipRole,
} from '../domain/project-membership.js';

export const listProjectMemberships = async (projectId: number) => {
  const flows = await getFlows();
  if (!flows.projects) throw new ForbiddenError('FLOW_DISABLED');
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    throw new BadRequestError('Invalid projectId');
  }
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new NotFoundError('Project not found');
  return prisma.projectMembership.findMany({
    where: { projectId },
    orderBy: [{ role: 'asc' }, { userId: 'asc' }],
    include: { user: { select: { id: true, uuid: true, name: true, email: true } } },
  });
};

export const upsertProjectMembership = async (input: {
  projectId: number;
  userId: number;
  role: string;
}) => {
  const flows = await getFlows();
  if (!flows.projects) throw new ForbiddenError('FLOW_DISABLED');

  let role: ProjectMembershipRole;
  try {
    role = assertProjectMembershipRole(input.role);
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0) {
    throw new BadRequestError('Invalid projectId');
  }
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) {
    throw new BadRequestError('Invalid userId');
  }

  const [project, user] = await Promise.all([
    prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true, clientId: true } }),
    prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!project) throw new NotFoundError('Project not found');
  if (!user) throw new NotFoundError('User not found');

  return prisma.projectMembership.upsert({
    where: {
      projectId_userId: { projectId: input.projectId, userId: input.userId },
    },
    create: {
      projectId: input.projectId,
      userId: input.userId,
      role,
    },
    update: { role },
  });
};

export const removeProjectMembership = async (input: {
  projectId: number;
  userId: number;
}) => {
  const flows = await getFlows();
  if (!flows.projects) throw new ForbiddenError('FLOW_DISABLED');

  try {
    await prisma.projectMembership.delete({
      where: {
        projectId_userId: { projectId: input.projectId, userId: input.userId },
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    ) {
      throw new NotFoundError('Project membership not found');
    }
    throw error;
  }
  return { removed: true };
};
