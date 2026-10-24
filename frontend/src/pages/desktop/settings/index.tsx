import { translate as translateUi } from '../../../i18n';
import React, { useCallback, useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import api from '../../../services/api';
import { extractApiError } from '../../../utils/formatters';

interface DesktopSettings {
  remoteUrl: string | null;
  connected: boolean;
  backupDir: string | null;
  lastSyncedAt: string | null;
  lastSyncStatus: 'idle' | 'syncing' | 'ok' | 'offline' | 'error';
  lastSyncError: string | null;
}

interface BackupFile {
  name: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
}

const card = 'rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm';
const btnPrimary =
  'rounded-lg bg-tt-action px-4 py-2 text-sm font-medium text-tt-on-action transition hover:bg-tt-action disabled:opacity-50';
const btnSecondary =
  'rounded-lg border border-tt-border px-3 py-1.5 text-sm font-medium text-tt-text transition hover:bg-tt-page disabled:opacity-50';
const inputCls =
  'w-full rounded-lg border border-tt-border px-4 py-2 outline-none transition focus:ring-2 focus:ring-tt-focus';

const STATUS_LABEL: Record<DesktopSettings['lastSyncStatus'], { text: string; cls: string }> = {
  idle: { text: 'Aguardando', cls: 'bg-tt-elevated text-tt-text' },
  syncing: { text: 'Sincronizando...', cls: 'bg-tt-info-soft text-tt-link' },
  ok: { text: 'Sincronizado', cls: 'bg-tt-success-soft text-tt-success' },
  offline: { text: 'Offline (alterações ficam locais)', cls: 'bg-tt-elevated text-tt-warning' },
  error: { text: 'Erro na sincronização', cls: 'bg-tt-danger-soft text-tt-danger' },
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('pt-BR') : '—';

const DesktopSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [backupDir, setBackupDir] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [restoring, setRestoring] = useState<BackupFile | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([
        api.get('/api/desktop/settings'),
        api.get('/api/desktop/backups'),
      ]);
      setSettings(s.data.data);
      setBackupDir(s.data.data.backupDir ?? b.data.data.backupDir ?? '');
      setBackups(b.data.data.backups ?? []);
    } catch (e) {
      setError(extractApiError(e, 'Falha ao carregar configurações'));
    }
  }, []);

  useEffect(() => {
    void load();
    // Enquanto a tela estiver aberta, atualiza o status de sync.
    const timer = setInterval(() => {
      api
        .get('/api/desktop/settings')
        .then((r) => setSettings(r.data.data))
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const run = async (action: () => Promise<void>, okMessage: string) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(okMessage);
      await load();
    } catch (e) {
      setError(extractApiError(e, 'Operacao falhou'));
    } finally {
      setBusy(false);
    }
  };

  const status = settings ? STATUS_LABEL[settings.lastSyncStatus] : null;

  return (
    <AppShell
      title={translateUi('Configuracoes')}
      subtitle={translateUi('Sincronizacao com o servidor e backups locais')}
    >
      {error ? (
        <div className="mb-4 rounded-lg bg-tt-danger-soft px-4 py-3 text-sm text-tt-danger ">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-lg bg-tt-success-soft px-4 py-3 text-sm text-tt-success ">
          {success}
        </div>
      ) : null}

      <section className={`${card} mb-6`}>
        <h3 className="mb-4 text-lg font-semibold text-tt-text">{translateUi('Sincronizacao')}</h3>

        <div className="flex flex-wrap items-center gap-3">
          {status ? (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.cls}`}>
              {status.text}
            </span>
          ) : null}
          <span className="text-sm text-tt-text-muted">
            {translateUi('Servidor:')}
            <strong>{settings?.remoteUrl || 'não configurado'}</strong>
          </span>
          <span className="text-sm text-tt-text-muted">
            {translateUi('Ultima sincronizacao:')} {formatDate(settings?.lastSyncedAt ?? null)}
          </span>
          <button
            className={btnPrimary}
            disabled={busy || !settings?.connected}
            onClick={() =>
              run(async () => {
                await api.post('/api/desktop/sync-now');
              }, 'Sincronização executada')
            }
          >
            {translateUi('Sincronizar agora')}
          </button>
        </div>

        {settings?.lastSyncError ? (
          <p className="mt-3 text-xs text-tt-danger ">
            {translateUi('Ultimo erro:')} {settings.lastSyncError}
          </p>
        ) : null}
        {!settings?.connected ? (
          <p className="mt-3 text-xs text-tt-text-muted">
            {translateUi('Faca login informando a URL do servidor para ativar a sincronizacao.')}
          </p>
        ) : null}
      </section>

      <section className={card}>
        <h3 className="mb-4 text-lg font-semibold text-tt-text">Backup</h3>

        <label className="mb-1 block text-xs font-medium text-tt-text-muted">
          {translateUi('Pasta de destino')}
        </label>
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className={`${inputCls} flex-1 min-w-[280px]`}
            value={backupDir}
            onChange={(e) => setBackupDir(e.target.value)}
            placeholder="C:\Users\voce\Documents\TimeTrackerBackups"
          />
          <button
            className={btnSecondary}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api.put('/api/desktop/settings', { backupDir: backupDir.trim() });
              }, 'Pasta de backup salva')
            }
          >
            {translateUi('Salvar pasta')}
          </button>
          <button
            className={btnPrimary}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api.post('/api/desktop/backups');
              }, 'Backup criado')
            }
          >
            {translateUi('Fazer backup agora')}
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="text-sm text-tt-text-muted">{translateUi('Nenhum backup nesta pasta.')}</p>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.path}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tt-border px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-tt-text">{b.name}</p>
                  <p className="text-xs text-tt-text-muted">
                    {formatDate(b.createdAt)} · {formatBytes(b.sizeBytes)}
                  </p>
                </div>
                <button className={btnSecondary} disabled={busy} onClick={() => setRestoring(b)}>
                  {translateUi('Restaurar')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {restoring ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-tt-surface p-6 shadow-xl">
            <h4 className="mb-2 text-lg font-semibold text-tt-text">
              {translateUi('Restaurar backup')}
            </h4>
            <p className="mb-4 text-sm text-tt-text-muted">
              <strong>{restoring.name}</strong>
              {translateUi('— escolha como aplicar:')}
            </p>

            <div className="space-y-3">
              <div className="rounded-xl border border-tt-border p-3">
                <p className="text-sm font-medium text-tt-text">{translateUi('Substituir')}</p>
                <p className="mb-2 text-xs text-tt-text-muted">
                  {translateUi('Descarta os dados atuais e usa exatamente o conteudo do backup.')}
                </p>
                <button
                  className={btnSecondary}
                  disabled={busy}
                  onClick={() => {
                    const file = restoring.path;
                    setRestoring(null);
                    void run(async () => {
                      await api.post('/api/desktop/backups/restore', { file, mode: 'replace' });
                    }, 'Backup restaurado (substituicao)');
                  }}
                >
                  {translateUi('Substituir dados atuais')}
                </button>
              </div>

              <div className="rounded-xl border border-tt-border p-3">
                <p className="text-sm font-medium text-tt-text">{translateUi('Mesclar')}</p>
                <p className="mb-2 text-xs text-tt-text-muted">
                  {translateUi(
                    'Mantem os dados atuais e traz os do backup; em conflito, vence o mais recente.'
                  )}
                </p>
                <button
                  className={btnPrimary}
                  disabled={busy}
                  onClick={() => {
                    const file = restoring.path;
                    setRestoring(null);
                    void run(async () => {
                      await api.post('/api/desktop/backups/restore', { file, mode: 'merge' });
                    }, 'Backup mesclado');
                  }}
                >
                  {translateUi('Mesclar com os dados atuais')}
                </button>
              </div>
            </div>

            <button
              className="mt-4 text-sm text-tt-text-muted hover:underline"
              onClick={() => setRestoring(null)}
            >
              {translateUi('Cancelar')}
            </button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
};

export default DesktopSettingsPage;
