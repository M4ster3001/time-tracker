import type { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../../app/http/presenters/api.presenter.js';
import { toAppError, UnauthorizedError, BadRequestError } from '../../../app/errors/app-error.js';
import {
  archiveProject,
  createProject,
  listProjectsForClient,
  updateProject,
} from '../application/project.service.js';
import {
  listProjectMemberships,
  removeProjectMembership,
  upsertProjectMembership,
} from '../application/project-membership.service.js';
import {
  classifyLegacyEntriesForProject,
  previewLegacyEntriesWithoutProject,
} from '../application/legacy-project-classify.service.js';
import type { ProjectState } from '../domain/project.rules.js';

const requireUser = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Unauthorized');
  return req.user;
};

export const listProjectsController = async (req: Request, res: Response): Promise<void> => {
  try {
    requireUser(req);
    const clientId = Number(req.query.clientId ?? req.params.clientId);
    if (!Number.isSafeInteger(clientId) || clientId <= 0) {
      throw new BadRequestError('clientId is required');
    }
    sendSuccess(res, 200, await listProjectsForClient(clientId));
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const createProjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    requireUser(req);
    const { clientId, code, name, description, state, ownerUserId } = req.body ?? {};
    const project = await createProject({
      clientId: Number(clientId),
      code: String(code ?? ''),
      name: String(name ?? ''),
      description: description == null ? null : String(description),
      state: state as ProjectState | undefined,
      ownerUserId: ownerUserId == null ? null : Number(ownerUserId),
    });
    sendSuccess(res, 201, project);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const updateProjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    requireUser(req);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestError('Invalid id');
    const { name, description, state, ownerUserId } = req.body ?? {};
    const project = await updateProject(id, {
      name: name === undefined ? undefined : String(name),
      description: description === undefined ? undefined : description == null ? null : String(description),
      state: state as ProjectState | undefined,
      ownerUserId:
        ownerUserId === undefined ? undefined : ownerUserId == null ? null : Number(ownerUserId),
    });
    sendSuccess(res, 200, project);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const archiveProjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    requireUser(req);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestError('Invalid id');
    sendSuccess(res, 200, await archiveProject(id));
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const listProjectMembershipsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    requireUser(req);
    const projectId = Number(req.params.id);
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      throw new BadRequestError('Invalid id');
    }
    sendSuccess(res, 200, await listProjectMemberships(projectId));
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const upsertProjectMembershipController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    requireUser(req);
    const projectId = Number(req.params.id);
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      throw new BadRequestError('Invalid id');
    }
    const membership = await upsertProjectMembership({
      projectId,
      userId: Number(req.body?.userId),
      role: String(req.body?.role ?? 'MEMBER'),
    });
    sendSuccess(res, 200, membership);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const removeProjectMembershipController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    requireUser(req);
    const projectId = Number(req.params.id);
    const userId = Number(req.params.userId);
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      throw new BadRequestError('Invalid id');
    }
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new BadRequestError('Invalid userId');
    }
    sendSuccess(res, 200, await removeProjectMembership({ projectId, userId }));
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const previewLegacyEntriesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    requireUser(req);
    const projectId = Number(req.params.id);
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      throw new BadRequestError('Invalid id');
    }
    const limit =
      req.query.limit == null || req.query.limit === ''
        ? undefined
        : Number(req.query.limit);
    sendSuccess(res, 200, await previewLegacyEntriesWithoutProject(projectId, { limit }));
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const classifyLegacyEntriesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireUser(req);
    const projectId = Number(req.params.id);
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      throw new BadRequestError('Invalid id');
    }
    const entryIds = Array.isArray(req.body?.entryIds) ? req.body.entryIds : [];
    const dryRun = Boolean(req.body?.dryRun);
    sendSuccess(
      res,
      200,
      await classifyLegacyEntriesForProject({
        projectId,
        entryIds,
        actorUserId: user.userId,
        dryRun,
      })
    );
  } catch (error) {
    sendError(res, toAppError(error));
  }
};
