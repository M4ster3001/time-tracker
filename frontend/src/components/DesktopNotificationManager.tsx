import { translate as translateUi } from '../i18n';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from '../contexts/CapabilitiesContext';
import {
  dismissNotificationReminder,
  getPendingNotificationReminders,
  getNotificationStatus,
  snoozeNotificationReminder,
} from '../services/notifications';
import {
  browserSupportsNotifications,
  getNotificationPermission,
  type PendingReminder,
} from '../utils/notificationPreferences';

const POLL_INTERVAL_MS = 60_000;
const SESSION_STORAGE_KEY = 'shownNotificationReminderIds';

const readShownIds = (): number[] => {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is number => typeof item === 'number')
      : [];
  } catch (_error) {
    return [];
  }
};

const writeShownIds = (ids: number[]): void => {
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(ids));
};

const DesktopNotificationManager: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { can } = useCapabilities();
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<PendingReminder[]>([]);
  const [shownIds, setShownIds] = useState<number[]>(() =>
    typeof window === 'undefined' ? [] : readShownIds()
  );
  const [storageReady, setStorageReady] = useState<boolean>(false);

  const canUseNotifications = isAuthenticated && can('notifications.manage');

  const rememberShown = useCallback((reminderId: number) => {
    setShownIds((prev) => {
      if (prev.includes(reminderId)) return prev;
      const next = [...prev, reminderId];
      writeShownIds(next);
      return next;
    });
  }, []);

  const forgetShown = useCallback((reminderId: number) => {
    setShownIds((prev) => {
      const next = prev.filter((item) => item !== reminderId);
      writeShownIds(next);
      return next;
    });
  }, []);

  const showDesktopNotification = useCallback(
    (reminder: PendingReminder) => {
      if (!browserSupportsNotifications()) return;
      if (getNotificationPermission() !== 'granted') return;
      if (shownIds.includes(reminder.id)) return;

      const notification = new window.Notification('Lembrete de lançamento', {
        body: `${reminder.clientName} ainda não tem lançamento hoje. Abra e registre sua atividade.`,
        tag: `time-tracker-reminder-${reminder.id}`,
      });
      notification.onclick = () => {
        window.focus();
        navigate(reminder.launchUrl);
        notification.close();
      };

      rememberShown(reminder.id);
    },
    [navigate, rememberShown, shownIds]
  );

  const refreshReminders = useCallback(async () => {
    if (!canUseNotifications) {
      setReminders([]);
      return;
    }
    if (!storageReady) {
      setReminders([]);
      return;
    }

    try {
      const nextReminders = await getPendingNotificationReminders();
      setReminders(nextReminders);
      nextReminders.forEach(showDesktopNotification);
    } catch (_error) {
      setReminders([]);
    }
  }, [canUseNotifications, showDesktopNotification, storageReady]);

  useEffect(() => {
    if (!canUseNotifications) return;
    let intervalId: number | null = null;
    const onFocus = () => void refreshReminders();

    const bootstrap = async () => {
      try {
        const status = await getNotificationStatus();
        setStorageReady(status.ready);
        if (!status.ready) {
          setReminders([]);
          return;
        }
        await refreshReminders();
        intervalId = window.setInterval(refreshReminders, POLL_INTERVAL_MS);
        window.addEventListener('focus', onFocus);
      } catch (_error) {
        setStorageReady(false);
        setReminders([]);
      }
    };

    void bootstrap();
    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('focus', onFocus);
    };
  }, [canUseNotifications, refreshReminders]);

  const handleDismiss = async (reminderId: number) => {
    await dismissNotificationReminder(reminderId);
    setReminders((prev) => prev.filter((item) => item.id !== reminderId));
    rememberShown(reminderId);
  };

  const handleSnooze = async (reminderId: number) => {
    await snoozeNotificationReminder(reminderId);
    setReminders((prev) => prev.filter((item) => item.id !== reminderId));
    forgetShown(reminderId);
  };

  const handleOpen = (launchUrl: string, reminderId: number) => {
    rememberShown(reminderId);
    navigate(launchUrl);
  };

  if (!canUseNotifications || !storageReady || reminders.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[10000] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      {reminders.map((reminder) => (
        <div
          key={reminder.id}
          className="pointer-events-auto rounded-3xl border border-tt-border bg-tt-surface/95 p-4 shadow-[0_18px_50px_-24px_rgba(12,42,36,0.6)] backdrop-blur/95"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tt-warning ">
            {translateUi('Lembrete')}
          </p>
          <h3 className="mt-2 text-base font-semibold text-tt-text">
            {reminder.clientName}
            {translateUi('ainda sem lancamento')}
          </h3>
          <p className="mt-1 text-sm text-tt-text-muted">
            {translateUi('Horario')} {reminder.scheduledTime}. Registre o que voce fez para este
            cliente.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleOpen(reminder.launchUrl, reminder.id)}
              className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action"
            >
              {translateUi('Abrir lancamento')}
            </button>
            <button
              type="button"
              onClick={() => void handleSnooze(reminder.id)}
              className="rounded-2xl border border-tt-border bg-tt-surface px-4 py-2 text-sm font-semibold text-tt-warning"
            >
              {translateUi('Adiar')}
            </button>
            <button
              type="button"
              onClick={() => void handleDismiss(reminder.id)}
              className="rounded-2xl border border-tt-border bg-tt-page px-4 py-2 text-sm font-semibold text-tt-text"
            >
              {translateUi('Dispensar')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DesktopNotificationManager;
