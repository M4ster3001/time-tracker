import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  dismissNotificationReminder,
  getNotificationPreferences,
  getNotificationStorageStatus,
  listPendingNotificationReminders,
  snoozeNotificationReminder,
  updateNotificationPreferences,
} from './notification-reminder.service.js';

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    userClient: {
      findMany: vi.fn(),
    },
    timeEntry: {
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

describe('notification-reminder.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      roleId: 3,
      isActive: true,
    } as never);
    vi.mocked(prisma.userClient.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
    vi.mocked(prisma.$executeRaw).mockResolvedValue(0 as never);
  });

  it('returns default preferences for eligible users without saved row', async () => {
    const preference = await getNotificationPreferences(7);

    expect(preference).toEqual({
      enabled: false,
      times: ['11:00', '16:00'],
      snoozeMinutes: 30,
    });
  });

  it('reports missing storage when notification tables are absent', async () => {
    const status = await getNotificationStorageStatus();

    expect(status.ready).toBe(false);
    expect(status.missingTables).toEqual(
      expect.arrayContaining(['user_notification_preferences', 'notification_reminders'])
    );
  });

  it('persists normalized preferences', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { TABLE_NAME: 'user_notification_preferences' },
      { TABLE_NAME: 'notification_reminders' },
    ] as never);

    const preference = await updateNotificationPreferences(7, {
      enabled: true,
      times: ['16:00', '11:00', '11:00'],
      snoozeMinutes: 45,
    });

    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(preference).toEqual({
      enabled: true,
      times: ['11:00', '16:00'],
      snoozeMinutes: 45,
    });
  });

  it('returns pending reminders only for allocated linked clients without entries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T14:00:00-03:00'));

    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        { TABLE_NAME: 'user_notification_preferences' },
        { TABLE_NAME: 'notification_reminders' },
      ] as never)
      .mockResolvedValueOnce([
        {
          enabled: true,
          timesJson: JSON.stringify(['11:00']),
          snoozeMinutes: 30,
        },
      ] as never)
      .mockResolvedValueOnce([{ clientId: 11 }] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        {
          id: 91,
          clientId: 11,
          reminderDate: new Date('2026-03-20T00:00:00.000Z'),
          scheduledTime: '11:00',
          status: 'PENDING',
          snoozedUntil: null,
          triggeredAt: new Date('2026-03-20T14:00:00.000Z'),
        },
      ] as never);
    vi.mocked(prisma.userClient.findMany).mockResolvedValue([
      {
        clientId: 11,
        client: { id: 11, name: 'Cliente X', isActive: true },
      },
      {
        clientId: 12,
        client: { id: 12, name: 'Cliente Y', isActive: true },
      },
    ] as never);
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValue([] as never);

    const reminders = await listPendingNotificationReminders(7);

    expect(reminders).toEqual([
      {
        id: 91,
        clientId: 11,
        clientName: 'Cliente X',
        date: '2026-03-20',
        scheduledTime: '11:00',
        missingMinutes: 1,
        status: 'pending',
        launchUrl: '/time-entries/new?clientId=11',
      },
    ]);

    vi.useRealTimers();
  });

  it('does not return pending reminders after work is already logged today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T14:00:00-03:00'));

    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        { TABLE_NAME: 'user_notification_preferences' },
        { TABLE_NAME: 'notification_reminders' },
      ] as never)
      .mockResolvedValueOnce([
        {
          enabled: true,
          timesJson: JSON.stringify(['11:00']),
          snoozeMinutes: 30,
        },
      ] as never)
      .mockResolvedValueOnce([{ clientId: 11 }] as never)
      .mockResolvedValueOnce([
        {
          id: 91,
          clientId: 11,
          reminderDate: new Date('2026-03-20T00:00:00.000Z'),
          scheduledTime: '11:00',
          status: 'COMPLETED',
          snoozedUntil: null,
          triggeredAt: new Date('2026-03-20T14:00:00.000Z'),
        },
      ] as never);
    vi.mocked(prisma.userClient.findMany).mockResolvedValue([
      {
        clientId: 11,
        client: { id: 11, name: 'Cliente X', isActive: true },
      },
    ] as never);
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValue([
      { clientId: 11, _sum: { durationMinutes: 120 } },
    ] as never);

    const reminders = await listPendingNotificationReminders(7);

    expect(reminders).toEqual([]);
    expect(prisma.$executeRaw).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('dismisses a reminder for the same user', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { TABLE_NAME: 'user_notification_preferences' },
      { TABLE_NAME: 'notification_reminders' },
    ] as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        id: 44,
        clientId: 11,
        reminderDate: new Date('2026-03-20T00:00:00.000Z'),
        scheduledTime: '11:00',
        status: 'PENDING',
        snoozedUntil: null,
        triggeredAt: null,
      },
    ] as never);

    await dismissNotificationReminder(7, 44);

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('snoozes a reminder using explicit minutes', async () => {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        { TABLE_NAME: 'user_notification_preferences' },
        { TABLE_NAME: 'notification_reminders' },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: 44,
          clientId: 11,
          reminderDate: new Date('2026-03-20T00:00:00.000Z'),
          scheduledTime: '11:00',
          status: 'PENDING',
          snoozedUntil: null,
          triggeredAt: null,
        },
      ] as never)
      .mockResolvedValueOnce([] as never);

    await snoozeNotificationReminder(7, 44, 20);

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });
});
