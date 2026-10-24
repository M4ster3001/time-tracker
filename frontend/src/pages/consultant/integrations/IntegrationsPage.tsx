import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import ConfirmDialog from '../../../components/ConfirmDialog';
import StateBanner from '../../../components/StateBanner';
import { SkeletonList } from '../../../components/Skeleton';
import { useNotice } from '../../../hooks/useNotice';
import { extractApiError, formatDate } from '../../../utils/formatters';
import {
  createAccessToken,
  fetchAccessTokens,
  revokeAccessToken,
} from './services/accessTokens.service';
import { ACCESS_TOKEN_STATUS_LABEL, getAccessTokenStatus } from './accessTokenStatus.logic';
import { ACCESS_TOKEN_EXPIRY_DAYS_OPTIONS } from './types/accessTokens.types';
import type {
  AccessToken,
  AccessTokenExpiryDays,
  CreatedAccessToken,
} from './types/accessTokens.types';

const statusBadgeClass: Record<string, string> = {
  active: 'bg-tt-success-soft text-tt-success',
  expired: 'bg-tt-elevated text-tt-text-muted',
  revoked: 'bg-tt-danger-soft text-tt-danger',
};

const IntegrationsPage: React.FC = () => {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { notice, showNotice } = useNotice();

  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<AccessTokenExpiryDays>(180);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<CreatedAccessToken | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<AccessToken | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadTokens = async () => {
    setLoading(true);
    setError(null);
    try {
      setTokens(await fetchAccessTokens());
    } catch (err) {
      setError(extractApiError(err, 'Falha ao carregar tokens de acesso'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!label.trim()) return;
    setCreating(true);
    try {
      const created = await createAccessToken(label.trim(), expiresInDays);
      setJustCreated(created);
      setCopied(false);
      setLabel('');
      await loadTokens();
    } catch (err) {
      showNotice('error', extractApiError(err, 'Falha ao gerar token'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!justCreated) return;
    await navigator.clipboard.writeText(justCreated.rawToken);
    setCopied(true);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeAccessToken(revokeTarget.id);
      setRevokeTarget(null);
      showNotice('success', 'Token revogado com sucesso.');
      await loadTokens();
    } catch (err) {
      showNotice('error', extractApiError(err, 'Falha ao revogar token'));
    } finally {
      setRevoking(false);
    }
  };

  return (
    <AppShell
      title={translateUi('Integracoes')}
      subtitle={translateUi(
        'Gere tokens de acesso para ferramentas externas registrarem horas por voce'
      )}
    >
      {notice ? (
        <StateBanner
          tone={notice.type === 'success' ? 'success' : 'error'}
          message={notice.message}
        />
      ) : null}

      <section className="animate-fade-up rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-tt-warning">
          {translateUi('Token de acesso pessoal')}
        </p>
        <h3 className="mt-2 text-lg font-semibold text-tt-text">
          {translateUi('Gerar novo token')}
        </h3>
        <p className="mt-2 text-sm text-tt-text-muted">
          Use esse token para deixar uma ferramenta externa (ex: um assistente de IA lendo seus
          commits) registrar lancamentos por voce, chamando a API com{' '}
          <code className="rounded bg-tt-elevated px-1.5 py-0.5 text-xs">
            Authorization: Bearer
          </code>
          .
        </p>

        <form onSubmit={handleCreate} className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr_auto]">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={translateUi('Rotulo (ex: Cursor - commits)')}
            aria-label="Rótulo do token"
            required
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          />
          <select
            value={expiresInDays}
            onChange={(event) =>
              setExpiresInDays(Number(event.target.value) as AccessTokenExpiryDays)
            }
            aria-label="Validade do token"
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          >
            {ACCESS_TOKEN_EXPIRY_DAYS_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days}
                {translateUi('dias')}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creating || !label.trim()}
            className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action disabled:opacity-60"
          >
            {creating ? 'Gerando...' : 'Gerar token'}
          </button>
        </form>

        {justCreated ? (
          <div className="mt-6 rounded-2xl border border-tt-border bg-tt-warning-soft p-4">
            <p className="text-sm font-semibold text-tt-warning">
              {translateUi('Copie agora — este token nao sera mostrado novamente.')}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="flex-1 break-all rounded-xl border border-tt-border bg-tt-surface px-3 py-2 text-xs text-tt-text">
                {justCreated.rawToken}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-full border border-tt-border px-4 py-2 text-xs font-semibold text-tt-warning hover:bg-tt-elevated"
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <details className="mt-4 text-xs text-tt-text-muted">
              <summary className="cursor-pointer font-semibold text-tt-warning">
                {translateUi('Como usar (exemplo curl)')}
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-tt-elevated p-3 font-mono text-[11px] text-tt-text">
                {`curl -H "Authorization: Bearer ${justCreated.rawToken}" \\
 ${window.location.origin}/api/users/SEU_USER_ID/clients

curl -X POST -H "Authorization: Bearer ${justCreated.rawToken}" \\
 -H "Content-Type: application/json" \\
 -d '{"entries":[{"clientId":1,"date":"2026-07-22","activityDescription":"Ajustes no modulo X","durationMinutes":120}]}' \\
 ${window.location.origin}/api/time-entries/bulk`}
              </pre>
            </details>
          </div>
        ) : null}
      </section>

      {loading ? (
        <SkeletonList count={3} />
      ) : error ? (
        <StateBanner
          tone="error"
          message={error}
          action={{ label: translateUi('Tentar novamente'), onClick: loadTokens }}
        />
      ) : (
        <section className="animate-fade-up rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-tt-text">{translateUi('Seus tokens')}</h3>
          {tokens.length === 0 ? (
            <p className="mt-4 text-sm text-tt-text-muted">
              {translateUi('Nenhum token gerado ainda.')}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm text-tt-text">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.2em] text-tt-warning">
                    <th className="px-2 py-3">{translateUi('Rotulo')}</th>
                    <th className="px-2 py-3">{translateUi('Criado em')}</th>
                    <th className="px-2 py-3">{translateUi('Expira em')}</th>
                    <th className="px-2 py-3">{translateUi('Ultimo uso')}</th>
                    <th className="px-2 py-3">Status</th>
                    <th className="px-2 py-3">{translateUi('Acoes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => {
                    const status = getAccessTokenStatus(token);
                    return (
                      <tr key={token.id} className="border-t border-tt-border">
                        <td className="px-2 py-3 font-semibold text-tt-text">{token.label}</td>
                        <td className="px-2 py-3">{formatDate(token.createdAt)}</td>
                        <td className="px-2 py-3">{formatDate(token.expiresAt)}</td>
                        <td className="px-2 py-3">
                          {token.lastUsedAt ? formatDate(token.lastUsedAt) : 'Nunca usado'}
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass[status]}`}
                          >
                            {ACCESS_TOKEN_STATUS_LABEL[status]}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          {status !== 'revoked' ? (
                            <button
                              type="button"
                              onClick={() => setRevokeTarget(token)}
                              disabled={revoking}
                              className="rounded-full border border-tt-danger px-3 py-1 text-xs text-tt-danger hover:bg-tt-danger-soft disabled:opacity-60"
                            >
                              {translateUi('Revogar')}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        isOpen={revokeTarget !== null}
        title={translateUi('Revogar token')}
        message={`Tem certeza que deseja revogar o token "${revokeTarget?.label}"? Ferramentas que usam esse token deixarao de conseguir acessar a API imediatamente.`}
        confirmLabel={translateUi('Revogar')}
        variant="danger"
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </AppShell>
  );
};

export default IntegrationsPage;
