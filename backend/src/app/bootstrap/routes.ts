import type { Express, RequestHandler } from 'express';
import {
  authMiddleware as authenticate,
  managerMiddleware,
  adminMiddleware,
} from '../http/middleware/auth.middleware.js';
import { authorizeRequest } from '../../modules/access-control/http/authorization.middleware.js';
import { registerAccessControlRoutes } from '../../modules/access-control/http/routes.js';
import { registerHourBalanceRoutes } from '../../modules/hour-balances/http/routes.js';
import { registerMonthCloseRoutes } from '../../modules/month-close/http/routes.js';
import { registerProjectRoutes } from '../../modules/projects/http/routes.js';
import { registerEstimateRoutes } from '../../modules/estimates/http/routes.js';
import { registerTrackingRoutes } from '../../modules/tracking/http/routes.js';
import { registerMcpRoutes } from '../../modules/mcp/http/routes.js';
import { exportOptionsController } from '../../modules/reports/http/export/options.controller.js';
const authMiddleware: RequestHandler[] = [authenticate, authorizeRequest];
import { validate, validateZod, schemas } from '../http/middleware/validation.middleware.js';
import {
  loginLimiter,
  refreshLimiter,
  revokeLimiter,
  adminWriteLimiter,
  adminReadLimiter,
  apiLimiter,
  aiLimiter,
} from './security.js';
import {
  setupStatusController,
  setupController,
  registerController,
  loginController,
  meController,
  refreshController,
  logoutController,
  revokeUserSessionsController,
  unlockUserController,
} from '../../controllers/auth.controller.js';
import {
  createTimeEntryController,
  listTimeEntriesController,
  getTimeEntryController,
  updateTimeEntryController,
  deleteTimeEntryController,
  monthSummaryController,
  bulkTimeEntriesController,
  lockStatusController,
  batchLockStatusController,
  listSupervisedTimeEntriesController,
} from '../../controllers/timeentry.controller.js';
import {
  consultantDashboardController,
  managerDashboardController,
} from '../../controllers/dashboard.controller.js';
import { getUserClientsController } from '../../controllers/user.controller.js';
import {
  listUsersController,
  createUserController,
  getUserController,
  updateUserController,
  deleteUserController,
  addUserClientController,
  removeUserClientController,
  changePasswordController,
} from '../../controllers/admin.user.controller.js';
import {
  listClientsController,
  createClientController,
  getClientController,
  updateClientController,
  deleteClientController,
  getClientUsersController,
} from '../../controllers/admin.client.controller.js';
import { adminDashboardController } from '../../controllers/admin.dashboard.controller.js';
import { listAuditLogsController } from '../../modules/audit/http/controller.js';
import {
  createAccessTokenController,
  listAccessTokensController,
  revokeAccessTokenController,
  adminListAccessTokensController,
  adminRevokeAccessTokenController,
} from '../../modules/access-tokens/http/controller.js';
import {
  createAccessTokenSchema,
  accessTokenIdParamSchema,
} from '../../modules/access-tokens/http/schemas.js';
import { exportTimeEntriesController } from '../../controllers/admin.export.controller.js';
import {
  deleteAdminConsultantAllocationController,
  listAdminConsultantAllocationsController,
  upsertAdminConsultantAllocationController,
} from '../../controllers/admin.allocation.controller.js';
import {
  listManagerClientsController,
  listManagedConsultantsController,
  updateManagerClientLockDayController,
} from '../../modules/managers/http/controller.js';
import {
  deleteManagedConsultantAllocationController,
  listManagedConsultantAllocationsController,
  upsertManagedConsultantAllocationController,
} from '../../modules/allocations/http/manager.controller.js';
import { listActivityTagsController } from '../../controllers/activity-tag.controller.js';
import {
  googleCalendarAuthUrlController,
  googleCalendarCallbackController,
  googleCalendarStatusController,
  googleCalendarDisconnectController,
  googleCalendarEventsController,
  googleCalendarImportController,
} from '../../controllers/google-calendar.controller.js';
import { aiStatusController, aiSuggestionsController } from '../../controllers/ai.controller.js';
import {
  getBackupStatusController,
  triggerBackupController,
} from '../../controllers/backup.controller.js';
import {
  consultantPerformanceReport,
  clientCapacityReport,
} from '../../controllers/admin-report.controller.js';
import { hourPoolReportController } from '../../modules/reports/http/controller.js';
import { hourPoolExportController } from '../../modules/reports/http/export/hour-pool-export.js';
import { hourPoolQuerySchema, hourPoolExportQuerySchema } from '../../modules/reports/http/schemas.js';
import {
  bulkImportController,
  bulkActivateController,
  bulkDeactivateController,
  csvTemplateController,
} from '../../controllers/admin-bulk.controller.js';
import {
  healthCheckController,
  healthLiveController,
  healthReadyController,
  jobsStatusController,
} from '../../controllers/health.controller.js';
import {
  retentionStatusController,
  retentionCleanupController,
  retentionHistoryController,
} from '../../controllers/data-retention.controller.js';
import {
  getNotificationPreferencesController,
  getNotificationStatusController,
  updateNotificationPreferencesController,
  listPendingNotificationRemindersController,
  dismissNotificationReminderController,
  snoozeNotificationReminderController,
} from '../../modules/notifications/http/controller.js';
import {
  grantTemporaryUnlockController,
  revokeTemporaryUnlockController,
  listTemporaryUnlocksController,
  getTemporaryUnlockDetailsController,
} from '../../controllers/temporary-unlock.controller.js';
import { loginSchema, registerSchema, userIdParamSchema } from '../../modules/auth/http/schemas.js';
import { pullController, pushController } from '../../modules/sync/http/controller.js';
import {
  pullQuerySchema,
  pushBodySchema,
  connectBodySchema,
  updateSettingsBodySchema,
  restoreBodySchema,
} from '../../modules/sync/http/schemas.js';
import {
  getSettingsController,
  updateSettingsController,
  connectController,
  syncNowController,
  listBackupsController,
  createBackupController,
  restoreBackupController,
} from '../../modules/sync/http/desktop.controller.js';

export const registerRoutes = (app: Express): void => {
  registerAccessControlRoutes(app, [...authMiddleware, apiLimiter]);
  registerHourBalanceRoutes(app, [...authMiddleware, apiLimiter]);
  registerMonthCloseRoutes(app, [...authMiddleware, apiLimiter]);
  registerProjectRoutes(app, authMiddleware, { read: adminReadLimiter, write: adminWriteLimiter });
  registerEstimateRoutes(app, authMiddleware, apiLimiter);
  registerTrackingRoutes(app, authMiddleware, apiLimiter);
  registerMcpRoutes(app, authMiddleware, apiLimiter);
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/health/live', healthLiveController);
  app.get('/health/ready', healthReadyController);

  // Primeiro boot: cria o admin inicial. O service so permite com o banco vazio.
  app.get('/api/auth/setup-status', setupStatusController);
  app.post(
    '/api/auth/setup',
    loginLimiter,
    validateZod('body', registerSchema),
    setupController
  );

  app.post('/api/auth/register', loginLimiter, validateZod('body', registerSchema), registerController);
  app.post('/api/auth/login', loginLimiter, validateZod('body', loginSchema), loginController);
  app.get('/api/auth/me', authMiddleware, meController);
  app.post('/api/auth/refresh', refreshLimiter, refreshController);
  app.post('/api/auth/logout', authMiddleware, refreshLimiter, logoutController);
  app.post(
    '/api/auth/revoke/:userId',
    authMiddleware,
    adminMiddleware,
    revokeLimiter,
    validateZod('params', userIdParamSchema),
    revokeUserSessionsController
  );
  app.post(
    '/api/auth/unlock/:userId',
    authMiddleware,
    adminMiddleware,
    validateZod('params', userIdParamSchema),
    unlockUserController
  );
  app.get('/api/users/:id/clients', authMiddleware, apiLimiter, getUserClientsController);

  app.get('/api/users', authMiddleware, adminMiddleware, adminReadLimiter, listUsersController);
  app.post(
    '/api/users',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    validate('body', schemas.createUser),
    createUserController
  );
  app.get('/api/users/:id', authMiddleware, adminMiddleware, adminReadLimiter, getUserController);
  app.put(
    '/api/users/:id',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    validate('body', schemas.updateUser),
    updateUserController
  );
  app.delete(
    '/api/users/:id',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    deleteUserController
  );
  app.post(
    '/api/users/:id/clients/:clientId',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    addUserClientController
  );
  app.delete(
    '/api/users/:id/clients/:clientId',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    removeUserClientController
  );
  app.post(
    '/api/users/:id/change-password',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    changePasswordController
  );
  app.get(
    '/api/users/:id/allocations',
    authMiddleware,
    adminMiddleware,
    listAdminConsultantAllocationsController
  );
  app.put(
    '/api/users/:id/allocations/:clientId',
    authMiddleware,
    adminMiddleware,
    upsertAdminConsultantAllocationController
  );
  app.delete(
    '/api/users/:id/allocations/:clientId',
    authMiddleware,
    adminMiddleware,
    deleteAdminConsultantAllocationController
  );

  app.post(
    '/api/time-entries',
    authMiddleware,
    apiLimiter,
    validate('body', schemas.createTimeEntry),
    createTimeEntryController
  );
  app.get('/api/time-entries', authMiddleware, apiLimiter, listTimeEntriesController);
  app.get(
    '/api/time-entries/supervised',
    authMiddleware,
    apiLimiter,
    listSupervisedTimeEntriesController
  );
  app.get('/api/time-entries/month/summary', authMiddleware, apiLimiter, monthSummaryController);
  app.post(
    '/api/time-entries/bulk',
    authMiddleware,
    apiLimiter,
    validate('body', schemas.bulkTimeEntries),
    bulkTimeEntriesController
  );
  app.get('/api/time-entries/lock-status', authMiddleware, apiLimiter, lockStatusController);
  app.post(
    '/api/time-entries/lock-status/batch',
    authMiddleware,
    apiLimiter,
    batchLockStatusController
  );
  app.get('/api/time-entries/:id', authMiddleware, apiLimiter, getTimeEntryController);
  app.put(
    '/api/time-entries/:id',
    authMiddleware,
    apiLimiter,
    validate('body', schemas.updateTimeEntry),
    updateTimeEntryController
  );
  app.delete('/api/time-entries/:id', authMiddleware, apiLimiter, deleteTimeEntryController);

  app.get(
    '/api/google-calendar/auth-url',
    authMiddleware,
    apiLimiter,
    googleCalendarAuthUrlController
  );
  app.get('/api/google-calendar/callback', googleCalendarCallbackController);
  app.get(
    '/api/google-calendar/status',
    authMiddleware,
    apiLimiter,
    googleCalendarStatusController
  );
  app.post(
    '/api/google-calendar/disconnect',
    authMiddleware,
    apiLimiter,
    googleCalendarDisconnectController
  );
  app.get(
    '/api/google-calendar/events',
    authMiddleware,
    apiLimiter,
    googleCalendarEventsController
  );
  app.post(
    '/api/google-calendar/import',
    authMiddleware,
    apiLimiter,
    googleCalendarImportController
  );

  app.get('/api/dashboards/consultant', authMiddleware, apiLimiter, consultantDashboardController);
  app.get(
    '/api/dashboards/manager',
    authMiddleware,
    managerMiddleware,
    apiLimiter,
    managerDashboardController
  );
  app.get(
    '/api/dashboards/admin',
    authMiddleware,
    adminMiddleware,
    apiLimiter,
    adminDashboardController
  );

  app.get(
    '/api/manager/clients',
    authMiddleware,
    managerMiddleware,
    apiLimiter,
    listManagerClientsController
  );
  app.get(
    '/api/manager/consultants',
    authMiddleware,
    managerMiddleware,
    apiLimiter,
    listManagedConsultantsController
  );
  app.patch(
    '/api/manager/clients/:id/lock-day',
    authMiddleware,
    managerMiddleware,
    apiLimiter,
    updateManagerClientLockDayController
  );
  app.get(
    '/api/manager/consultants/:id/allocations',
    authMiddleware,
    managerMiddleware,
    apiLimiter,
    listManagedConsultantAllocationsController
  );
  app.put(
    '/api/manager/consultants/:id/allocations/:clientId',
    authMiddleware,
    managerMiddleware,
    apiLimiter,
    upsertManagedConsultantAllocationController
  );
  app.delete(
    '/api/manager/consultants/:id/allocations/:clientId',
    authMiddleware,
    managerMiddleware,
    apiLimiter,
    deleteManagedConsultantAllocationController
  );

  app.get('/api/activity-tags', authMiddleware, apiLimiter, listActivityTagsController);

  app.get(
    '/api/notifications/preferences',
    authMiddleware,
    apiLimiter,
    getNotificationPreferencesController
  );
  app.get('/api/notifications/status', authMiddleware, apiLimiter, getNotificationStatusController);
  app.put(
    '/api/notifications/preferences',
    authMiddleware,
    apiLimiter,
    updateNotificationPreferencesController
  );
  app.get(
    '/api/notifications/reminders/pending',
    authMiddleware,
    apiLimiter,
    listPendingNotificationRemindersController
  );
  app.post(
    '/api/notifications/reminders/:id/dismiss',
    authMiddleware,
    apiLimiter,
    dismissNotificationReminderController
  );
  app.post(
    '/api/notifications/reminders/:id/snooze',
    authMiddleware,
    apiLimiter,
    snoozeNotificationReminderController
  );

  app.get('/api/ai/status', authMiddleware, apiLimiter, aiStatusController);
  app.post('/api/ai/suggestions', authMiddleware, aiLimiter, aiSuggestionsController);

  app.get('/api/clients', authMiddleware, adminMiddleware, adminReadLimiter, listClientsController);
  app.post(
    '/api/clients',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    validate('body', schemas.createClient),
    createClientController
  );
  app.get(
    '/api/clients/:id',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    getClientController
  );
  app.put(
    '/api/clients/:id',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    validate('body', schemas.updateClient),
    updateClientController
  );
  app.delete(
    '/api/clients/:id',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    deleteClientController
  );
  app.get(
    '/api/clients/:id/users',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    getClientUsersController
  );

  app.get('/api/audit-logs', authMiddleware, adminMiddleware, apiLimiter, listAuditLogsController);

  // Tokens de acesso pessoal (PAT) - permite ferramentas externas (scripts, IA)
  // chamarem a API como o proprio usuario, sem depender de login via navegador.
  app.post(
    '/api/access-tokens',
    authMiddleware,
    apiLimiter,
    validateZod('body', createAccessTokenSchema),
    createAccessTokenController
  );
  app.get('/api/access-tokens', authMiddleware, apiLimiter, listAccessTokensController);
  app.delete(
    '/api/access-tokens/:id',
    authMiddleware,
    apiLimiter,
    validateZod('params', accessTokenIdParamSchema),
    revokeAccessTokenController
  );
  app.get(
    '/api/admin/access-tokens',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    adminListAccessTokensController
  );
  app.delete(
    '/api/admin/access-tokens/:id',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    validateZod('params', accessTokenIdParamSchema),
    adminRevokeAccessTokenController
  );

  app.get(
    '/api/admin/backup/status',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    getBackupStatusController
  );
  app.post(
    '/api/admin/backup/trigger',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    triggerBackupController
  );

  app.get(
    '/api/admin/reports/consultant-performance',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    consultantPerformanceReport
  );
  app.get(
    '/api/admin/reports/client-capacity',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    clientCapacityReport
  );
  app.get(
    '/api/admin/reports/hour-pool',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    validateZod('query', hourPoolQuerySchema),
    hourPoolReportController
  );
  app.get(
    '/api/admin/reports/hour-pool/export',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    validateZod('query', hourPoolExportQuerySchema),
    hourPoolExportController
  );

  app.get(
    '/api/admin/users/csv-template',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    csvTemplateController
  );
  app.post(
    '/api/admin/users/bulk-import',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    bulkImportController
  );
  app.post(
    '/api/admin/users/bulk-activate',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    bulkActivateController
  );
  app.post(
    '/api/admin/users/bulk-deactivate',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    bulkDeactivateController
  );

  app.get(
    '/api/admin/health',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    healthCheckController
  );
  app.get(
    '/api/admin/jobs/status',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    jobsStatusController
  );

  app.get(
    '/api/admin/retention/status',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    retentionStatusController
  );
  app.post(
    '/api/admin/retention/cleanup',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    retentionCleanupController
  );
  app.get(
    '/api/admin/retention/history',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    retentionHistoryController
  );

  app.get(
    '/api/admin/temporary-unlocks',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    listTemporaryUnlocksController
  );
  app.get(
    '/api/admin/temporary-unlocks/:id',
    authMiddleware,
    adminMiddleware,
    adminReadLimiter,
    getTemporaryUnlockDetailsController
  );
  app.post(
    '/api/admin/temporary-unlocks',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    grantTemporaryUnlockController
  );
  app.post(
    '/api/admin/temporary-unlocks/:id/revoke',
    authMiddleware,
    adminMiddleware,
    adminWriteLimiter,
    revokeTemporaryUnlockController
  );

  app.get('/api/export/options', authMiddleware, apiLimiter, exportOptionsController);
  app.get('/api/export/time-entries', authMiddleware, apiLimiter, exportTimeEntriesController);

  // Sincronizacao local <-> remoto (desktop). Escopado ao usuario do token.
  app.get('/api/sync/pull', authMiddleware, validateZod('query', pullQuerySchema), pullController);
  app.post('/api/sync/push', authMiddleware, validateZod('body', pushBodySchema), pushController);

  // Runtime desktop: config, login online-first (connect) e sync manual.
  app.get('/api/desktop/settings', getSettingsController);
  app.put('/api/desktop/settings', authMiddleware, validateZod('body', updateSettingsBodySchema), updateSettingsController);
  app.post('/api/desktop/connect', validateZod('body', connectBodySchema), connectController);
  app.post('/api/desktop/sync-now', authMiddleware, syncNowController);

  // Backup local do desktop.
  app.get('/api/desktop/backups', authMiddleware, listBackupsController);
  app.post('/api/desktop/backups', authMiddleware, createBackupController);
  app.post('/api/desktop/backups/restore', authMiddleware, validateZod('body', restoreBodySchema), restoreBackupController);
};
