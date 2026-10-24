import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import { logger } from '../../../../shared/infrastructure/logger/logger.js';
import type { AuthAuditRepository } from '../../domain/repositories/auth-audit.repository.js';

export class PrismaAuthAuditRepository implements AuthAuditRepository {
  async log(event: {
    userId: number | null;
    action: string;
    status: 'success' | 'failure';
    details?: string;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: event.userId,
          endpoint: '/api/auth',
          action: event.action,
          status: event.status,
          details: event.details ?? null,
        },
      });
    } catch (error) {
      logger.error({ err: error, action: event.action }, 'Failed to log auth event');
    }
  }
}

export const authAuditRepository = new PrismaAuthAuditRepository();
