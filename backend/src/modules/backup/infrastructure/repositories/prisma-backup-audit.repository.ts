import type { PrismaClient } from '@prisma/client';
import type { BackupAuditRepository } from '../../domain/repositories/backup-audit.repository.js';
import type { BackupResult } from '../../domain/providers/backup-provider.js';

export class PrismaBackupAuditRepository implements BackupAuditRepository {
  constructor(private readonly db: Pick<PrismaClient, 'auditLog'>) {}

  async logBackupResult(filename: string, results: BackupResult[]): Promise<void> {
    const successCount = results.filter((result) => result.success).length;
    const status =
      successCount === results.length ? 'success' : successCount > 0 ? 'partial' : 'failed';

    await this.db.auditLog.create({
      data: {
        userId: null,
        endpoint: '/system/backup',
        action: 'DATABASE_BACKUP',
        status,
        details: JSON.stringify({
          filename,
          providers: results.map((result) => ({
            name: result.provider,
            success: result.success,
            path: result.path,
            size: result.size,
            error: result.error,
          })),
        }),
      },
    });
  }

  async logBackupFailure(filename: string, error: string): Promise<void> {
    await this.db.auditLog.create({
      data: {
        userId: null,
        endpoint: '/system/backup',
        action: 'DATABASE_BACKUP',
        status: 'failed',
        details: JSON.stringify({ filename, error }),
      },
    });
  }
}
