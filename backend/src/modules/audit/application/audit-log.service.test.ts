import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import * as auditLogService from './audit-log.service.js';

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
    },
  },
}));

describe('AuditLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('deve listar logs com filtros', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([] as any);
    const result = await auditLogService.listAuditLogs({ userId: 1, action: 'CREATE' });
    expect(result).toEqual([]);
  });

  it('deve listar logs sem filtros', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([] as any);
    const result = await auditLogService.listAuditLogs({});
    expect(result).toEqual([]);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('deve listar logs apenas por acao', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([] as any);
    await auditLogService.listAuditLogs({ action: 'LOGIN', limit: 10 });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { action: { contains: 'LOGIN' } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  });
});
