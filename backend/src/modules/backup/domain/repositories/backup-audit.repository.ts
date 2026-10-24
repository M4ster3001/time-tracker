import type { BackupResult } from '../providers/backup-provider.js';

export interface BackupAuditRepository {
  logBackupResult(filename: string, results: BackupResult[]): Promise<void>;
  logBackupFailure(filename: string, error: string): Promise<void>;
}
