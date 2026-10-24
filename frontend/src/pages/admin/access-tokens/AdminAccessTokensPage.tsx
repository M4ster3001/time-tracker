import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import ConfirmDialog from '../../../components/ConfirmDialog';
import StateBanner from '../../../components/StateBanner';
import { SkeletonList } from '../../../components/Skeleton';
import { useNotice } from '../../../hooks/useNotice';
import { extractApiError, formatDate } from '../../../utils/formatters';
import {
  ACCESS_TOKEN_STATUS_LABEL,
  getAccessTokenStatus,
} from '../../consultant/integrations/accessTokenStatus.logic';
import { adminRevokeAccessToken, fetchAllAccessTokens } from './services';
import type { AccessTokenWithOwner } from './types';

const statusBadgeClass: Record<string, string> = {
  active: 'bg-tt-success-soft text-tt-success',
  expired: 'bg-tt-elevated text-tt-text-muted',
  revoked: 'bg-tt-danger-soft text-tt-danger',
};

const AdminAccessTokensPage: React.FC = () => {
  const [tokens, setTokens] = useState<AccessTokenWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { notice, showNotice } = useNotice();
  const [revokeTarget, setRevokeTarget] = useState<AccessTokenWithOwner | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadTokens = async () => {
    setLoading(true);
    setError(null);
    try {
      setTokens(await fetchAllAccessTokens());
    } catch (err) {
      setError(extractApiError(err, 'Falha ao carregar tokens de acesso'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await adminRevokeAccessToken(revokeTarget.id);
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
      title={translateUi('Tokens de Acesso')}
      subtitle={translateUi(
        'Tokens de acesso pessoal gerados por qualquer usuario, para auditoria e revogacao'
      )}
    >
      {notice ? (
        <StateBanner
          tone={notice.type === 'success' ? 'success' : 'error'}
          message={notice.message}
        />
      ) : null}

      {loading ? (
        <SkeletonList count={5} />
      ) : error ? (
        <StateBanner
          tone="error"
          message={error}
          action={{ label: translateUi('Tentar novamente'), onClick: loadTokens }}
        />
      ) : (
        <section className="animate-fade-up rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          {tokens.length === 0 ? (
            <p className="text-sm text-tt-text-muted">
              {translateUi('Nenhum token gerado por nenhum usuario ainda.')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm text-tt-text">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.2em] text-tt-warning">
                    <th className="px-2 py-3">{translateUi('Usuario')}</th>
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
                        <td className="px-2 py-3">
                          <p className="font-semibold text-tt-text">{token.ownerName}</p>
                          <p className="text-xs text-tt-text-muted">{token.ownerEmail}</p>
                        </td>
                        <td className="px-2 py-3">{token.label}</td>
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
        message={`Tem certeza que deseja revogar o token "${revokeTarget?.label}" de ${revokeTarget?.ownerName}?`}
        confirmLabel={translateUi('Revogar')}
        variant="danger"
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </AppShell>
  );
};

export default AdminAccessTokensPage;
