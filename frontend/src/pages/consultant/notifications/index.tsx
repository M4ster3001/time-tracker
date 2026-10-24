import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import InfoTooltip from '../../../components/InfoTooltip';
import ScreenState from '../../../components/ScreenState';
import StateBanner from '../../../components/StateBanner';
import { FieldCheckbox, FieldInput } from '../../../components/FormControls';
import {
  getNotificationPreferences,
  getNotificationStatus,
  updateNotificationPreferences,
} from '../../../services/notifications';
import { extractApiError } from '../../../utils/formatters';
import {
  browserSupportsNotifications,
  getNotificationPermission,
  normalizeNotificationTimes,
  type NotificationPreference,
  type NotificationStorageStatus,
} from '../../../utils/notificationPreferences';

const DEFAULT_TIMES = ['11:00', '16:00'];

const NotificationSettingsPage: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreference>({
    enabled: false,
    times: DEFAULT_TIMES,
    snoozeMinutes: 30,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<NotificationStorageStatus | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(
    browserSupportsNotifications() ? getNotificationPermission() : 'denied'
  );

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [status, data] = await Promise.all([
          getNotificationStatus(),
          getNotificationPreferences(),
        ]);
        setStorageStatus(status);
        setPreferences(data);
      } catch (err) {
        setError(extractApiError(err, 'Não foi possível carregar as notificações.'));
      } finally {
        setLoading(false);
      }
    };

    void loadPreferences();
  }, []);

  const normalizedTimes = useMemo(
    () => normalizeNotificationTimes(preferences.times),
    [preferences.times]
  );

  const updateTimeAt = (index: number, value: string) => {
    setPreferences((prev) => ({
      ...prev,
      times: prev.times.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const addTime = () => {
    setPreferences((prev) => ({
      ...prev,
      times: [...prev.times, '09:00'],
    }));
  };

  const removeTime = (index: number) => {
    setPreferences((prev) => ({
      ...prev,
      times: prev.times.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const requestPermission = async () => {
    if (!browserSupportsNotifications()) return;
    const nextPermission = await window.Notification.requestPermission();
    setPermission(nextPermission);
    setPermissionMessage(
      nextPermission === 'granted'
        ? 'Permissão concedida. Agora você pode receber lembretes com o navegador aberto.'
        : nextPermission === 'denied'
          ? 'Permissão bloqueada. Libere manualmente nas configurações do navegador para este site.'
          : 'A permissão continua pendente. Verifique se o navegador mostrou o pedido.'
    );
  };

  const sendTestNotification = () => {
    if (!browserSupportsNotifications() || getNotificationPermission() !== 'granted') {
      setPermissionMessage('Conceda a permissão antes de enviar uma notificação de teste.');
      return;
    }

    const notification = new window.Notification('Time Tracker', {
      body: 'Teste de notificação desktop funcionando.',
      tag: 'time-tracker-test-notification',
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setPermissionMessage('Notificação de teste enviada.');
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        ...preferences,
        times: normalizedTimes,
      };
      const data = await updateNotificationPreferences(payload);
      setPreferences(data);
      setSuccess('Preferências de notificação salvas.');
    } catch (err) {
      setError(extractApiError(err, 'Não foi possível salvar as notificações.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell
        title={translateUi('Notificacoes')}
        subtitle={translateUi('Configure lembretes desktop de lancamento')}
      >
        <ScreenState
          variant="loading"
          title={translateUi('Carregando preferencias')}
          description="Estamos buscando suas configurações de lembrete."
        />
      </AppShell>
    );
  }

  const storageUnavailable = storageStatus !== null && !storageStatus.ready;

  return (
    <AppShell
      title={translateUi('Notificacoes')}
      subtitle={translateUi('Configure lembretes desktop de lancamento')}
    >
      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <StateBanner
          tone={
            browserSupportsNotifications()
              ? permission === 'granted'
                ? 'success'
                : 'warning'
              : 'info'
          }
          message={
            browserSupportsNotifications()
              ? permission === 'granted'
                ? 'O navegador já pode mostrar notificações no sistema operacional.'
                : permission === 'denied'
                  ? 'As notificações foram bloqueadas no navegador. Libere nas configurações do site se quiser usar esta funcao.'
                  : 'Ative a permissão do navegador para receber notificações no Linux, macOS ou Windows enquanto a aplicação estiver aberta.'
              : 'Este navegador não suporta notificações desktop.'
          }
        />

        {storageUnavailable ? (
          <StateBanner
            tone="error"
            className="mt-4"
            message="As tabelas de notificação ainda não estão prontas. Aplique a migration do backend antes de salvar."
            action={{
              label: 'Ver detalhes',
              onClick: () =>
                setPermissionMessage(
                  `Faltando: ${storageStatus?.missingTables.join(', ') ?? 'desconhecido'}`
                ),
            }}
          />
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          {browserSupportsNotifications() && permission !== 'granted' ? (
            <button
              type="button"
              onClick={() => void requestPermission()}
              className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action"
            >
              {translateUi('Solicitar permissao')}
            </button>
          ) : null}
          {browserSupportsNotifications() && permission === 'granted' ? (
            <button
              type="button"
              onClick={sendTestNotification}
              className="rounded-2xl border border-tt-border bg-tt-surface px-4 py-2 text-sm font-semibold text-tt-warning"
            >
              {translateUi('Enviar notificacao de teste')}
            </button>
          ) : null}
        </div>

        {permissionMessage ? (
          <StateBanner tone="info" className="mt-4" message={permissionMessage} />
        ) : null}

        <form className="mt-6 space-y-6" onSubmit={handleSave}>
          <FieldCheckbox
            label={translateUi('Habilitar lembretes')}
            checked={preferences.enabled}
            onChange={(event) =>
              setPreferences((prev) => ({ ...prev, enabled: event.target.checked }))
            }
            disabled={storageUnavailable}
            hint="Se desativado, o sistema não vai buscar nem mostrar lembretes."
          />

          <div className="rounded-tt border border-tt-border bg-tt-surface p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <p className="text-sm font-semibold text-tt-text">
                  {translateUi('Horarios de lembrete')}
                </p>
                <InfoTooltip content="O sistema dispara no máximo uma vez por horário configurado." />
              </div>
              <button
                type="button"
                onClick={addTime}
                disabled={storageUnavailable}
                className="rounded-2xl border border-tt-border bg-tt-surface px-4 py-2 text-sm font-semibold text-tt-warning"
              >
                {translateUi('Adicionar horario')}
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {preferences.times.map((time, index) => (
                <div key={`${time}-${index}`} className="rounded-2xl border border-tt-border p-3">
                  <FieldInput
                    label={`Horário ${index + 1}`}
                    type="time"
                    value={time}
                    onChange={(event) => updateTimeAt(index, event.target.value)}
                    disabled={storageUnavailable}
                    inputClassName="[color-scheme:light] dark:bg-tt-elevated dark:text-tt-text"
                  />
                  <button
                    type="button"
                    onClick={() => removeTime(index)}
                    disabled={preferences.times.length === 1}
                    className="mt-3 rounded-2xl border border-tt-border bg-tt-page px-3 py-2 text-sm font-semibold text-tt-text disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {translateUi('Remover')}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <FieldInput
            label={translateUi('Minutos para adiar')}
            type="number"
            min={5}
            max={240}
            value={preferences.snoozeMinutes}
            onChange={(event) =>
              setPreferences((prev) => ({
                ...prev,
                snoozeMinutes: Number(event.target.value),
              }))
            }
            disabled={storageUnavailable}
            hint="Quando você clicar em adiar, o lembrete volta depois desse intervalo."
            inputClassName="md:max-w-xs"
          />

          {error ? <StateBanner tone="error" message={error} /> : null}
          {success ? <StateBanner tone="success" message={success} /> : null}

          <button
            type="submit"
            disabled={saving || storageUnavailable}
            className="rounded-2xl bg-tt-action px-5 py-3 text-sm font-semibold text-tt-on-action disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? translateUi('Salvando...') : 'Salvar preferências'}
          </button>
        </form>
      </section>
    </AppShell>
  );
};

export default NotificationSettingsPage;
