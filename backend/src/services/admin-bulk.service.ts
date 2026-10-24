import {
  adminBulkRepository,
  bulkActivateUsers as bulkActivateUsersUseCase,
  bulkDeactivateUsers as bulkDeactivateUsersUseCase,
  bulkImportUsers as bulkImportUsersUseCase,
  parseCsvContent,
} from '../modules/health/index.js';

export type {
  BulkImportResult,
  BulkStatusUpdateResult,
  CsvUserRow,
} from '../modules/health/application/admin-bulk.service.interfaces.js';
export { parseCsvContent };

import type { CsvUserRow } from '../modules/health/application/admin-bulk.service.interfaces.js';

export const bulkImportUsers = (rows: CsvUserRow[], adminUserId: number) =>
  bulkImportUsersUseCase(rows, adminUserId, { repository: adminBulkRepository });

export const bulkActivateUsers = (userIds: number[], adminUserId: number) =>
  bulkActivateUsersUseCase(userIds, adminUserId, { repository: adminBulkRepository });

export const bulkDeactivateUsers = (userIds: number[], adminUserId: number) =>
  bulkDeactivateUsersUseCase(userIds, adminUserId, { repository: adminBulkRepository });
