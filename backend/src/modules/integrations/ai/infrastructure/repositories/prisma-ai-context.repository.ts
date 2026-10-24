import type { PrismaClient } from '@prisma/client';
import { config } from '../../../../../config.js';
import type { AiContextRepository } from '../../domain/repositories/ai-context.repository.js';
import type { IAiContext } from '../../domain/ai.types.js';

export class PrismaAiContextRepository implements AiContextRepository {
  constructor(private readonly db: Pick<PrismaClient, 'timeEntry' | 'activityTag' | 'client'>) {}

  async buildContext(userId: number, clientId?: number): Promise<IAiContext> {
    const maxEntries = config.ai.maxContextEntries;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userEntries = await this.db.timeEntry.findMany({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { activityDescription: true },
      orderBy: { createdAt: 'desc' },
      take: maxEntries,
      distinct: ['activityDescription'],
    });

    const userTags = await this.db.activityTag.findMany({
      where: { userId },
      orderBy: [{ usageCount: 'desc' }, { lastUsedAt: 'desc' }],
      take: 10,
      select: { name: true },
    });

    let clientRecentActivities: string[] = [];
    let clientName: string | undefined;

    if (clientId) {
      const client = await this.db.client.findUnique({
        where: { id: clientId },
        select: { name: true },
      });
      clientName = client?.name ?? undefined;

      const clientEntries = await this.db.timeEntry.findMany({
        where: {
          clientId,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { activityDescription: true },
        orderBy: { createdAt: 'desc' },
        take: maxEntries,
        distinct: ['activityDescription'],
      });

      clientRecentActivities = clientEntries.map((entry) => entry.activityDescription);
    }

    return {
      userRecentActivities: userEntries.map((entry) => entry.activityDescription),
      clientRecentActivities,
      userActivityTags: userTags.map((tag) => tag.name),
      clientName,
    };
  }
}
