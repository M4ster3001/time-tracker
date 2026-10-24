import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import type {
  LinkedClientRow,
  NotificationRepository,
  PreferenceRow,
  ReminderRow,
  WorkedMinutesRow,
} from '../../domain/repositories/notification.repository.js';

export class PrismaNotificationRepository implements NotificationRepository {
  async findExistingTables(tableNames: readonly string[]): Promise<Set<string>> {
    const rows = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>(Prisma.sql`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (${Prisma.join([...tableNames])})
    `);

    return new Set((rows ?? []).map((row) => row.TABLE_NAME));
  }

  async findEligibleUser(userId: number): Promise<{ roleId: number; isActive: boolean } | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { roleId: true, isActive: true },
    });
  }

  async findPreferenceRow(userId: number): Promise<PreferenceRow | null> {
    const rows = await prisma.$queryRaw<PreferenceRow[]>(Prisma.sql`
      SELECT enabled, timesJson, snoozeMinutes
      FROM user_notification_preferences
      WHERE userId = ${userId}
      LIMIT 1
    `);

    return rows[0] ?? null;
  }

  async upsertPreferenceRow(
    userId: number,
    enabled: boolean,
    timesJson: string,
    snoozeMinutes: number
  ): Promise<void> {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO user_notification_preferences (
        userId,
        enabled,
        timesJson,
        snoozeMinutes,
        createdAt,
        updatedAt
      ) VALUES (
        ${userId},
        ${enabled},
        ${timesJson},
        ${snoozeMinutes},
        NOW(3),
        NOW(3)
      )
      ON DUPLICATE KEY UPDATE
        enabled = VALUES(enabled),
        timesJson = VALUES(timesJson),
        snoozeMinutes = VALUES(snoozeMinutes),
        updatedAt = NOW(3)
    `);
  }

  async findActiveLinkedClients(userId: number): Promise<LinkedClientRow[]> {
    const links = await prisma.userClient.findMany({
      where: { userId },
      select: { clientId: true, client: { select: { id: true, name: true, isActive: true } } },
    });

    return links
      .filter((link) => link.client?.isActive)
      .map((link) => link.client)
      .filter((client): client is LinkedClientRow => Boolean(client));
  }

  async findAllocatedClientIds(
    userId: number,
    candidateClientIds: number[],
    todayUtc: Date
  ): Promise<number[]> {
    if (candidateClientIds.length === 0) return [];

    const allocationRows = await prisma.$queryRaw<Array<{ clientId: number }>>(Prisma.sql`
      SELECT DISTINCT clientId
      FROM client_allocation_history
      WHERE userId = ${userId}
        AND clientId IN (${Prisma.join(candidateClientIds)})
        AND effectiveFrom <= ${todayUtc}
        AND (effectiveTo IS NULL OR effectiveTo >= ${todayUtc})
    `);

    return (allocationRows ?? []).map((row) => row.clientId);
  }

  async sumWorkedMinutesByClient(
    userId: number,
    clientIds: number[],
    date: Date
  ): Promise<WorkedMinutesRow[]> {
    const rows = await prisma.timeEntry.groupBy({
      by: ['clientId'],
      where: {
        userId,
        clientId: { in: clientIds },
        date,
      },
      _sum: { durationMinutes: true },
    });
    return rows as WorkedMinutesRow[];
  }

  async markRemindersCompleted(userId: number, todayUtc: Date, clientIds: number[]): Promise<void> {
    if (clientIds.length === 0) return;

    await prisma.$executeRaw(Prisma.sql`
      UPDATE notification_reminders
      SET status = 'COMPLETED',
          completedAt = NOW(3),
          updatedAt = NOW(3)
      WHERE userId = ${userId}
        AND reminderDate = ${todayUtc}
        AND clientId IN (${Prisma.join(clientIds)})
        AND status IN ('PENDING', 'SNOOZED')
    `);
  }

  async findReminders(userId: number, todayUtc: Date, clientIds: number[]): Promise<ReminderRow[]> {
    if (clientIds.length === 0) return [];

    return prisma.$queryRaw<ReminderRow[]>(Prisma.sql`
      SELECT id, clientId, reminderDate, scheduledTime, status, snoozedUntil, triggeredAt
      FROM notification_reminders
      WHERE userId = ${userId}
        AND reminderDate = ${todayUtc}
        AND clientId IN (${Prisma.join(clientIds)})
    `);
  }

  async createReminder(
    userId: number,
    clientId: number,
    todayUtc: Date,
    scheduledTime: string
  ): Promise<void> {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO notification_reminders (
        userId,
        clientId,
        reminderDate,
        scheduledTime,
        status,
        triggeredAt,
        createdAt,
        updatedAt
      ) VALUES (
        ${userId},
        ${clientId},
        ${todayUtc},
        ${scheduledTime},
        'PENDING',
        NOW(3),
        NOW(3),
        NOW(3)
      )
    `);
  }

  async findReminder(
    userId: number,
    clientId: number,
    todayUtc: Date,
    scheduledTime: string
  ): Promise<ReminderRow | null> {
    const rows = await prisma.$queryRaw<ReminderRow[]>(Prisma.sql`
      SELECT id, clientId, reminderDate, scheduledTime, status, snoozedUntil, triggeredAt
      FROM notification_reminders
      WHERE userId = ${userId}
        AND clientId = ${clientId}
        AND reminderDate = ${todayUtc}
        AND scheduledTime = ${scheduledTime}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async reactivateSnoozedReminder(reminderId: number): Promise<void> {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE notification_reminders
      SET status = 'PENDING',
          snoozedUntil = NULL,
          triggeredAt = NOW(3),
          updatedAt = NOW(3)
      WHERE id = ${reminderId}
    `);
  }

  async markReminderTriggered(reminderId: number): Promise<void> {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE notification_reminders
      SET triggeredAt = NOW(3),
          updatedAt = NOW(3)
      WHERE id = ${reminderId}
    `);
  }

  async findReminderById(userId: number, reminderId: number): Promise<ReminderRow | null> {
    const rows = await prisma.$queryRaw<ReminderRow[]>(Prisma.sql`
      SELECT id, clientId, reminderDate, scheduledTime, status, snoozedUntil, triggeredAt
      FROM notification_reminders
      WHERE id = ${reminderId}
        AND userId = ${userId}
      LIMIT 1
    `);

    return rows[0] ?? null;
  }

  async dismissReminder(reminderId: number): Promise<void> {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE notification_reminders
      SET status = 'DISMISSED',
          dismissedAt = NOW(3),
          snoozedUntil = NULL,
          updatedAt = NOW(3)
      WHERE id = ${reminderId}
    `);
  }

  async snoozeReminder(reminderId: number, snoozedUntil: Date): Promise<void> {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE notification_reminders
      SET status = 'SNOOZED',
          snoozedUntil = ${snoozedUntil},
          updatedAt = NOW(3)
      WHERE id = ${reminderId}
    `);
  }
}

export const notificationRepository = new PrismaNotificationRepository();
