import type { Express, RequestHandler } from 'express';
import {
  confirmDurationController,
  confirmWorkActivityDurationController,
  createEstimateRevisionController,
  createWorkActivityController,
  decideCalibrationController,
  getCalibrationPolicyController,
  getEstimateHistoryController,
  linkEstimationReferenceController,
  linkLocalGitCommitReferenceController,
  listDurationConfirmationsController,
  listEstimateRevisionsForEntryController,
  listEstimationReferencesForEntryController,
  listTaskTypesController,
  listTaskTypeParameterSetsController,
  createTaskTypeController,
  updateTaskTypeController,
  replaceTaskTypeParametersController,
  deactivateTaskTypeParameterSetController,
  previewCalibrationController,
  previewEstimateController,
  previewWorkActivityConfirmDurationController,
  putCalibrationPolicyController,
} from './controller.js';

export const registerEstimateRoutes = (
  app: Express,
  authMiddleware: RequestHandler[],
  limiter: RequestHandler
): void => {
  app.get('/api/task-types', ...authMiddleware, limiter, listTaskTypesController);
  app.post('/api/task-types', ...authMiddleware, limiter, createTaskTypeController);
  app.put('/api/task-types/:id', ...authMiddleware, limiter, updateTaskTypeController);
  app.get(
    '/api/task-types/:id/parameter-sets',
    ...authMiddleware,
    limiter,
    listTaskTypeParameterSetsController
  );
  app.put(
    '/api/task-types/:id/parameters',
    ...authMiddleware,
    limiter,
    replaceTaskTypeParametersController
  );
  app.post(
    '/api/task-types/:id/parameter-sets/:setId/deactivate',
    ...authMiddleware,
    limiter,
    deactivateTaskTypeParameterSetController
  );
  app.post('/api/estimates/preview', ...authMiddleware, limiter, previewEstimateController);
  app.post(
    '/api/estimates/references',
    ...authMiddleware,
    limiter,
    linkEstimationReferenceController
  );
  app.post(
    '/api/estimates/references/local-git',
    ...authMiddleware,
    limiter,
    linkLocalGitCommitReferenceController
  );
  app.post(
    '/api/estimates/calibration/preview',
    ...authMiddleware,
    limiter,
    previewCalibrationController
  );
  app.post(
    '/api/estimates/calibration/:id/decide',
    ...authMiddleware,
    limiter,
    decideCalibrationController
  );
  app.get(
    '/api/estimates/calibration/policy',
    ...authMiddleware,
    limiter,
    getCalibrationPolicyController
  );
  app.put(
    '/api/estimates/calibration/policy',
    ...authMiddleware,
    limiter,
    putCalibrationPolicyController
  );
  app.post('/api/work-activities', ...authMiddleware, limiter, createWorkActivityController);
  app.post(
    '/api/work-activities/:id/estimate-revisions',
    ...authMiddleware,
    limiter,
    createEstimateRevisionController
  );
  app.get(
    '/api/work-activities/:id/confirm-duration-preview',
    ...authMiddleware,
    limiter,
    previewWorkActivityConfirmDurationController
  );
  app.post(
    '/api/work-activities/:id/confirm-duration',
    ...authMiddleware,
    limiter,
    confirmWorkActivityDurationController
  );
  app.get(
    '/api/time-entries/:id/duration-confirmations',
    ...authMiddleware,
    limiter,
    listDurationConfirmationsController
  );
  app.get(
    '/api/time-entries/:id/estimate-revisions',
    ...authMiddleware,
    limiter,
    listEstimateRevisionsForEntryController
  );
  app.get(
    '/api/time-entries/:id/estimate-history',
    ...authMiddleware,
    limiter,
    getEstimateHistoryController
  );
  app.get(
    '/api/time-entries/:id/estimation-references',
    ...authMiddleware,
    limiter,
    listEstimationReferencesForEntryController
  );
  app.post(
    '/api/time-entries/:id/confirm-duration',
    ...authMiddleware,
    limiter,
    confirmDurationController
  );
};
