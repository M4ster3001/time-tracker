import type { Express, RequestHandler } from 'express';
import {
  getActiveTrackingSessionController,
  importTrackingSessionController,
  listTrackingSessionsController,
  pauseTrackingSessionController,
  resumeTrackingSessionController,
  startTrackingSessionController,
  stopTrackingSessionController,
} from './controller.js';

export const registerTrackingRoutes = (
  app: Express,
  authMiddleware: RequestHandler[],
  limiter: RequestHandler
): void => {
  app.get('/api/tracking-sessions', ...authMiddleware, limiter, listTrackingSessionsController);
  app.get(
    '/api/tracking-sessions/active',
    ...authMiddleware,
    limiter,
    getActiveTrackingSessionController
  );
  app.post('/api/tracking-sessions', ...authMiddleware, limiter, startTrackingSessionController);
  app.post(
    '/api/tracking-sessions/import',
    ...authMiddleware,
    limiter,
    importTrackingSessionController
  );
  app.post(
    '/api/tracking-sessions/:id/pause',
    ...authMiddleware,
    limiter,
    pauseTrackingSessionController
  );
  app.post(
    '/api/tracking-sessions/:id/resume',
    ...authMiddleware,
    limiter,
    resumeTrackingSessionController
  );
  app.post(
    '/api/tracking-sessions/:id/stop',
    ...authMiddleware,
    limiter,
    stopTrackingSessionController
  );
};
