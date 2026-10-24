import type { Express, RequestHandler } from 'express';
import {
  archiveProjectController,
  classifyLegacyEntriesController,
  createProjectController,
  listProjectMembershipsController,
  listProjectsController,
  previewLegacyEntriesController,
  removeProjectMembershipController,
  updateProjectController,
  upsertProjectMembershipController,
} from './controller.js';

export const registerProjectRoutes = (
  app: Express,
  authMiddleware: RequestHandler[],
  limiters: { read: RequestHandler; write: RequestHandler }
): void => {
  app.get('/api/projects', ...authMiddleware, limiters.read, listProjectsController);
  app.get(
    '/api/clients/:clientId/projects',
    ...authMiddleware,
    limiters.read,
    listProjectsController
  );
  app.post('/api/projects', ...authMiddleware, limiters.write, createProjectController);
  app.put('/api/projects/:id', ...authMiddleware, limiters.write, updateProjectController);
  app.post(
    '/api/projects/:id/archive',
    ...authMiddleware,
    limiters.write,
    archiveProjectController
  );
  app.get(
    '/api/projects/:id/memberships',
    ...authMiddleware,
    limiters.read,
    listProjectMembershipsController
  );
  app.put(
    '/api/projects/:id/memberships',
    ...authMiddleware,
    limiters.write,
    upsertProjectMembershipController
  );
  app.delete(
    '/api/projects/:id/memberships/:userId',
    ...authMiddleware,
    limiters.write,
    removeProjectMembershipController
  );
  app.get(
    '/api/projects/:id/legacy-entries',
    ...authMiddleware,
    limiters.read,
    previewLegacyEntriesController
  );
  app.post(
    '/api/projects/:id/classify-legacy-entries',
    ...authMiddleware,
    limiters.write,
    classifyLegacyEntriesController
  );
};
