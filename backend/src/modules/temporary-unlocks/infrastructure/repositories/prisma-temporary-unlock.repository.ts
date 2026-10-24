import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import { isDesktopRuntime } from '../../../../shared/infrastructure/runtime/app-runtime.js';
import type {
  TemporaryUnlockDetails,
  TemporaryUnlockListItem,
  TemporaryUnlockRepository,
} from '../../domain/repositories/temporary-unlock.repository.js';
import type { ITemporaryUnlock, ITemporaryUnlockEdit } from '../../domain/temporary-unlock.types.js';

const toDesktopJsonString = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return JSON.stringify(value);
};

const parseDesktopJsonString = (value: unknown): Record<string, unknown> | null => {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
};

export const prismaTemporaryUnlockRepository: TemporaryUnlockRepository = {
  async findUserStatus(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
  },

  async findClientStatus(clientId) {
    return prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, isActive: true },
    });
  },

  async hasUserClientLink(userId, clientId) {
    const link = await prisma.userClient.findUnique({
      where: { userId_clientId: { userId, clientId } },
      select: { userId: true },
    });
    return Boolean(link);
  },

  async findActiveUnlockForPeriod(params) {
    const unlock = await prisma.temporaryUnlock.findFirst({
      where: {
        userId: params.userId,
        clientId: params.clientId,
        periodYear: params.periodYear,
        periodMonth: params.periodMonth,
        revokedAt: null,
        expiresAt: { gt: params.now },
      },
    });
    return unlock as ITemporaryUnlock | null;
  },

  async createTemporaryUnlock(data) {
    const unlock = await prisma.temporaryUnlock.create({ data });
    return unlock as ITemporaryUnlock;
  },

  async findTemporaryUnlockById(id) {
    const unlock = await prisma.temporaryUnlock.findUnique({ where: { id } });
    return unlock as ITemporaryUnlock | null;
  },

  async updateTemporaryUnlock(id, data) {
    const unlock = await prisma.temporaryUnlock.update({ where: { id }, data });
    return unlock as ITemporaryUnlock;
  },

  async createAuditLog(data) {
    await prisma.auditLog.create({ data });
  },

  async createTemporaryUnlockEdit(data) {
    const payload = isDesktopRuntime()
      ? {
          ...data,
          previousData: toDesktopJsonString(data.previousData) as typeof data.previousData,
          newData: toDesktopJsonString(data.newData) as typeof data.newData,
        }
      : data;

    await prisma.temporaryUnlockEdit.create({ data: payload });
  },

  async listTemporaryUnlocks(params) {
    const where: Record<string, unknown> = {};
    if (params.userId) where.userId = params.userId;
    if (params.clientId) where.clientId = params.clientId;
    if (params.activeOnly) {
      where.revokedAt = null;
      where.expiresAt = { gt: params.now };
    }

    const [total, unlocks] = await Promise.all([
      prisma.temporaryUnlock.count({ where }),
      prisma.temporaryUnlock.findMany({
        where,
        include: {
          user: { select: { name: true } },
          admin: { select: { name: true } },
          client: { select: { name: true } },
          _count: { select: { edits: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
    ]);

    const items: TemporaryUnlockListItem[] = unlocks.map((unlock) => ({
      id: unlock.id,
      userId: unlock.userId,
      clientId: unlock.clientId,
      grantedBy: unlock.grantedBy,
      periodYear: unlock.periodYear,
      periodMonth: unlock.periodMonth,
      reason: unlock.reason,
      expiresAt: unlock.expiresAt,
      revokedAt: unlock.revokedAt,
      createdAt: unlock.createdAt,
      userName: unlock.user.name,
      clientName: unlock.client.name,
      adminName: unlock.admin.name,
      editCount: unlock._count.edits,
    }));

    return { items, total };
  },

  async findTemporaryUnlockDetails(id) {
    const unlock = await prisma.temporaryUnlock.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
        admin: { select: { name: true } },
        client: { select: { name: true } },
        edits: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!unlock) return null;

    const details: TemporaryUnlockDetails = {
      id: unlock.id,
      userId: unlock.userId,
      clientId: unlock.clientId,
      grantedBy: unlock.grantedBy,
      periodYear: unlock.periodYear,
      periodMonth: unlock.periodMonth,
      reason: unlock.reason,
      expiresAt: unlock.expiresAt,
      revokedAt: unlock.revokedAt,
      createdAt: unlock.createdAt,
      userName: unlock.user.name,
      clientName: unlock.client.name,
      adminName: unlock.admin.name,
      edits: unlock.edits.map((edit) => ({
        ...(edit as ITemporaryUnlockEdit),
        previousData: parseDesktopJsonString(edit.previousData),
        newData: parseDesktopJsonString(edit.newData),
      })),
    };

    return details;
  },

  async findActiveTemporaryUnlockByEntryDate(params) {
    const unlock = await prisma.temporaryUnlock.findFirst({
      where: {
        userId: params.userId,
        clientId: params.clientId,
        periodYear: params.periodYear,
        periodMonth: params.periodMonth,
        revokedAt: null,
        expiresAt: { gt: params.now },
      },
      select: { id: true },
    });

    return unlock ? { unlockId: unlock.id } : null;
  },
};
