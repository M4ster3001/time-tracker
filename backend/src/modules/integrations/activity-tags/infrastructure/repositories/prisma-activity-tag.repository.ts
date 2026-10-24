import type { PrismaClient } from '@prisma/client';
import type {
  ActivityTagRecord,
  ActivityTagRepository,
  QuickLogPatternRecord,
} from '../../domain/repositories/activity-tag.repository.js';

export class PrismaActivityTagRepository implements ActivityTagRepository {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      '$queryRaw' | '$executeRaw' | 'activityTag' | 'quickLogPattern'
    >
  ) {}

  async listByUser(userId: number, limit: number): Promise<ActivityTagRecord[]> {
    const tags = await this.db.$queryRaw<
      Array<{
        id: number;
        name: string;
        aiGenerated: boolean | number;
        usageCount: number;
        lastUsedAt: Date;
      }>
    >`SELECT id, name, aiGenerated, usageCount, lastUsedAt
      FROM activity_tags
      WHERE userId = ${userId}
      ORDER BY usageCount DESC, lastUsedAt DESC
      LIMIT ${limit}`;

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      aiGenerated: Boolean(tag.aiGenerated),
      usageCount: tag.usageCount,
      lastUsedAt: tag.lastUsedAt,
    }));
  }

  async upsertUsage(userId: number, name: string): Promise<void> {
    await this.db.activityTag.upsert({
      where: { userId_name: { userId, name } },
      update: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
      create: {
        userId,
        name,
        usageCount: 1,
        lastUsedAt: new Date(),
      },
    });
  }

  async listQuickLogPatterns(userId: number, clientId?: number): Promise<QuickLogPatternRecord[]> {
    const patterns = await this.db.quickLogPattern.findMany({
      where: {
        userId,
        ...(clientId
          ? {
              OR: [{ clientId }, { clientId: null }],
            }
          : {}),
      },
      orderBy: [{ usageCount: 'desc' }, { lastUsedAt: 'desc' }],
    });

    return patterns.map(
      (pattern): QuickLogPatternRecord => ({
        id: pattern.id,
        clientId: pattern.clientId,
        activityKey: pattern.activityKey,
        activityLabel: pattern.activityLabel,
        durationMinutes: pattern.durationMinutes,
        usageCount: pattern.usageCount,
        lastUsedAt: pattern.lastUsedAt,
      })
    );
  }

  async upsertQuickLogPattern(data: {
    userId: number;
    clientId: number | null;
    activityKey: string;
    activityLabel: string;
    durationMinutes: number;
  }): Promise<void> {
    const clientScopeKey = data.clientId ? `client:${data.clientId}` : 'global';
    await this.db.quickLogPattern.upsert({
      where: {
        userId_clientScopeKey_activityKey_durationMinutes: {
          userId: data.userId,
          clientScopeKey,
          activityKey: data.activityKey,
          durationMinutes: data.durationMinutes,
        },
      },
      update: {
        activityLabel: data.activityLabel,
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
      create: {
        userId: data.userId,
        clientId: data.clientId,
        clientScopeKey,
        activityKey: data.activityKey,
        activityLabel: data.activityLabel,
        durationMinutes: data.durationMinutes,
        usageCount: 1,
        lastUsedAt: new Date(),
      },
    });
  }

  async markAiGenerated(userId: number, name: string): Promise<void> {
    await this.db.$executeRaw`UPDATE activity_tags
      SET aiGenerated = true
      WHERE userId = ${userId} AND name = ${name}`;
  }
}
