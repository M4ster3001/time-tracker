import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import AppShell from '../../../components/AppShell';
import { useCapabilities } from '../../../contexts/CapabilitiesContext';
import { onTablistKeyDown } from '../../../hooks/tablistKeyboard';
import api from '../../../services/api';
import { text, useLocale } from '../../../i18n';
import { extractApiError, formatTimestamp, formatMinutes } from '../../../utils/formatters';

type Account = {
  id: number;
  name: string;
  kind: 'CLIENT' | 'PERSONAL';
  clientId: number | null;
  balanceMinutes: number;
  nextExpiry: string | null;
  allowNegative: boolean;
};
type Movement = {
  id: number;
  deltaMinutes: number;
  kind: string;
  reason: string;
  createdAt: string;
  expiresAt: string | null;
  parentId: number | null;
};
type Detail = Account & { movements: Movement[]; movementCount: number };
type Option = { id: number; name: string };
const movementLabel = (kind: string) =>
  ({
    CREDIT: text('Crédito', 'Credit'),
    DEBIT: text('Débito', 'Debit'),
    CLOSING: text('Fechamento', 'Month close'),
    CLOSING_RETURN: text('Devolução do fechamento', 'Month-close return'),
    CONTRACT_TRANSFER: text('Transferência contratual', 'Contract transfer'),
    EXPIRATION: text('Expiração', 'Expiry'),
    REVERSAL: text('Estorno', 'Reversal'),
    REVERSAL_PART: text('Compensação de estorno', 'Reversal compensation'),
    ADJUSTMENT: text('Ajuste', 'Adjustment'),
  })[kind] ?? kind;

export default function BalancesPage() {
  useLocale();
  const { can, capabilities } = useCapabilities();
  const write = can('balances.write');
  const [kind, setKind] = useState<'CLIENT' | 'PERSONAL'>(
    capabilities?.flows.clientHourPool ? 'CLIENT' : 'PERSONAL'
  );
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [options, setOptions] = useState<{ users: Option[]; clients: Option[] }>({
    users: [],
    clients: [],
  });
  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [reference, setReference] = useState('default');
  const [negative, setNegative] = useState(false);
  const [minutes, setMinutes] = useState('60');
  const [direction, setDirection] = useState('credit');
  const [reason, setReason] = useState('');
  const [expiry, setExpiry] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pendingKeys = useRef(new Map<string, string>());
  const postMovement = (path: string, body: Record<string, unknown>) => {
    const signature = JSON.stringify([path, body]);
    const requestKey = pendingKeys.current.get(signature) ?? crypto.randomUUID();
    pendingKeys.current.set(signature, requestKey);
    return api.post(path, { ...body, requestKey });
  };
  const load = useCallback(async (cursor?: number) => {
    const response = (await api.get('/api/hour-accounts', { params: { cursor } })).data.data;
    setAccounts((previous) => (cursor ? [...previous, ...response.items] : response.items));
    setNextCursor(response.nextCursor);
  }, []);
  useEffect(() => {
    void Promise.all([
      load(),
      api.get('/api/hour-accounts/options').then((response) => setOptions(response.data.data)),
    ]).catch((err) =>
      setError(extractApiError(err, text('Falha ao carregar saldos.', 'Unable to load balances.')))
    );
  }, [load]);
  useEffect(() => {
    let active = true;
    setDetail(null);
    if (selected)
      void api
        .get(`/api/hour-accounts/${selected}`)
        .then((response) => {
          if (active) setDetail(response.data.data);
        })
        .catch((err) => {
          if (active)
            setError(
              extractApiError(err, text('Falha ao carregar extrato.', 'Unable to load ledger.'))
            );
        });
    return () => {
      active = false;
    };
  }, [selected]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await load();
      if (selected) setDetail((await api.get(`/api/hour-accounts/${selected}`)).data.data);
      pendingKeys.current.clear();
      setMessage(text('Operação registrada no extrato.', 'Operation recorded in the ledger.'));
      setReason('');
    } catch (err) {
      setError(
        extractApiError(
          err,
          text('Não foi possível concluir a operação.', 'Unable to complete the operation.')
        )
      );
    } finally {
      setBusy(false);
    }
  };
  const enabled = Boolean(
    capabilities?.flows[kind === 'CLIENT' ? 'clientHourPool' : 'personalHourBank']
  );
  const movementReady =
    !busy && reason.trim().length >= 5 && Number.isInteger(Number(minutes)) && Number(minutes) > 0;
  return (
    <AppShell
      title={text('Saldos de horas', 'Hour balances')}
      subtitle={text(
        'Bolsões contratuais por cliente e banco individual em livros separados.',
        'Client contract pools and personal banks use separate ledgers.'
      )}
    >
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label={text('Tipo de saldo', 'Balance type')}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          const tabs = ['CLIENT', 'PERSONAL'] as const;
          onTablistKeyDown(event, {
            selectedIndex: tabs.indexOf(kind),
            length: tabs.length,
            selectIndex: (index) => {
              const next = tabs[index];
              if (!next) return;
              setKind(next);
              setSelected(null);
              setOwner('');
              window.requestAnimationFrame(() => {
                document.getElementById(`balances-tab-${next}`)?.focus();
              });
            },
          });
        }}
      >
        {(['CLIENT', 'PERSONAL'] as const).map((value) => (
          <button
            key={value}
            id={`balances-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={kind === value}
            aria-controls="balances-panel-accounts"
            tabIndex={kind === value ? 0 : -1}
            className={`workspace-tab ${kind === value ? 'active' : ''}`}
            onClick={() => {
              setKind(value);
              setSelected(null);
              setOwner('');
            }}
          >
            {value === 'CLIENT'
              ? text('Bolsão do cliente', 'Client pool')
              : text('Banco individual', 'Personal bank')}
          </button>
        ))}
      </div>
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="workspace-success" role="status">
          {message}
        </p>
      )}
      {!enabled && (
        <p className="workspace-panel">
          {text(
            'Novas movimentações estão desabilitadas. O histórico permanece disponível.',
            'New movements are disabled. History remains available.'
          )}
        </p>
      )}
      <section
        id="balances-panel-accounts"
        role="tabpanel"
        aria-labelledby={`balances-tab-${kind}`}
        className="workspace-panel"
      >
        <h3 className="text-lg font-semibold">
          {text('Contas e saldos', 'Accounts and balances')}
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {accounts
            .filter((account) => account.kind === kind)
            .map((account) => (
              <button
                key={account.id}
                className={`min-h-touch rounded-tt border p-4 text-left ${selected === account.id ? 'border-tt-action bg-tt-selection' : 'border-tt-border bg-tt-surface'}`}
                onClick={() => setSelected(account.id)}
                aria-pressed={selected === account.id}
              >
                <span className="block font-semibold text-tt-text">{account.name}</span>
                <strong className="mt-2 block font-mono text-xl tabular-nums text-tt-text">
                  {formatMinutes(account.balanceMinutes)}
                </strong>
                {account.nextExpiry && (
                  <span className="text-sm">
                    {text('Próximo vencimento: ', 'Next expiry: ')}
                    {formatTimestamp(account.nextExpiry)}
                  </span>
                )}
              </button>
            ))}
        </div>
        {!accounts.some((account) => account.kind === kind) && (
          <p className="mt-4 text-tt-text-muted">
            {text('Nenhuma conta encontrada.', 'No accounts found.')}
          </p>
        )}
        {nextCursor && (
          <button
            className="workspace-secondary mt-4"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void load(nextCursor)
                .catch((err) =>
                  setError(
                    extractApiError(
                      err,
                      text('Falha ao carregar contas.', 'Unable to load accounts.')
                    )
                  )
                )
                .finally(() => setBusy(false));
            }}
          >
            {text('Carregar mais contas', 'Load more accounts')}
          </button>
        )}
      </section>
      {write && enabled && (
        <details className="workspace-panel">
          <summary className="cursor-pointer font-semibold">
            {text('Criar conta de horas', 'Create an hour account')}
          </summary>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await api.post('/api/hour-accounts', {
                  kind,
                  ownerId: Number(owner),
                  name,
                  reference,
                  allowNegative: negative,
                });
                setName('');
              });
            }}
          >
            <label className="workspace-label">
              {text('Titular', 'Owner')}
              <select
                required
                className="workspace-input"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
              >
                <option value="">{text('Selecione', 'Select')}</option>
                {(kind === 'CLIENT' ? options.clients : options.users).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="workspace-label">
              {text('Nome da conta', 'Account name')}
              <input
                required
                maxLength={120}
                className="workspace-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            {kind === 'CLIENT' && (
              <label className="workspace-label">
                {text('Referência do contrato', 'Contract reference')}
                <input
                  required
                  pattern="[A-Za-z0-9_-]{1,50}"
                  className="workspace-input"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={negative}
                onChange={(event) => setNegative(event.target.checked)}
              />
              {text('Permitir saldo negativo', 'Allow a negative balance')}
            </label>
            <div>
              <button className="workspace-primary" disabled={busy}>
                {text('Criar conta', 'Create account')}
              </button>
            </div>
          </form>
        </details>
      )}
      {selected && !detail && (
        <p role="status">{text('Carregando extrato...', 'Loading ledger...')}</p>
      )}
      {detail && (
        <section className="workspace-panel">
          <h3 className="text-lg font-semibold">
            {detail.name} · {formatMinutes(detail.balanceMinutes)}
          </h3>
          {write && enabled && (
            <form
              className="my-5 grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() =>
                  postMovement(`/api/hour-accounts/${detail.id}/movements`, {
                    deltaMinutes: Number(minutes) * (direction === 'debit' ? -1 : 1),
                    reason,
                    expiresAt:
                      direction === 'credit' && expiry
                        ? new Date(`${expiry}T23:59:59`).toISOString()
                        : null,
                  })
                );
              }}
            >
              <label className="workspace-label">
                {text('Operação', 'Operation')}
                <select
                  className="workspace-input"
                  value={direction}
                  onChange={(event) => setDirection(event.target.value)}
                >
                  <option value="credit">{text('Crédito', 'Credit')}</option>
                  <option value="debit">{text('Débito', 'Debit')}</option>
                </select>
              </label>
              <label className="workspace-label">
                {text('Minutos', 'Minutes')}
                <input
                  className="workspace-input"
                  type="number"
                  min={1}
                  max={5256000}
                  step={1}
                  required
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                />
              </label>
              <label className="workspace-label sm:col-span-2">
                {text(
                  'Justificativa (também usada em estornos e transferências)',
                  'Reason (also used for reversals and transfers)'
                )}
                <input
                  className="workspace-input"
                  minLength={5}
                  maxLength={2000}
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              {direction === 'credit' && (
                <label className="workspace-label">
                  {text('Validade opcional', 'Optional expiry')}
                  <input
                    className="workspace-input"
                    type="date"
                    value={expiry}
                    onChange={(event) => setExpiry(event.target.value)}
                  />
                </label>
              )}
              <div className="flex items-end">
                <button disabled={!movementReady} className="workspace-primary">
                  {text('Registrar movimentação', 'Record movement')}
                </button>
              </div>
              {kind === 'CLIENT' && (
                <div className="sm:col-span-2 flex flex-wrap items-end gap-3">
                  <label className="workspace-label flex-1">
                    {text(
                      'Transferir para contrato do mesmo cliente',
                      'Transfer to another contract of this client'
                    )}
                    <select
                      className="workspace-input"
                      value={destination}
                      onChange={(event) => setDestination(event.target.value)}
                    >
                      <option value="">{text('Selecione', 'Select')}</option>
                      {accounts
                        .filter(
                          (account) =>
                            account.kind === 'CLIENT' &&
                            account.id !== detail.id &&
                            account.clientId === detail.clientId
                        )
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="workspace-secondary"
                    disabled={!movementReady || !destination}
                    onClick={() => {
                      void run(() =>
                        postMovement(`/api/hour-accounts/${detail.id}/transfer`, {
                          destinationId: Number(destination),
                          minutes: Number(minutes),
                          reason,
                        })
                      );
                    }}
                  >
                    {text('Transferir minutos', 'Transfer minutes')}
                  </button>
                </div>
              )}
            </form>
          )}
          <p className="mt-3 text-sm text-tt-text-muted">
            {text('Últimas 200 movimentações. Total: ', 'Last 200 movements. Total: ')}
            {detail.movementCount}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    text('Data', 'Date'),
                    text('Tipo', 'Type'),
                    text('Variação de horas', 'Time change'),
                    text('Motivo / validade', 'Reason / expiry'),
                    text('Ação', 'Action'),
                  ].map((label) => (
                    <th key={label} scope="col" className="p-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.movements.map((movement) => (
                  <tr className="border-t border-tt-border" key={movement.id}>
                    <td className="p-3 whitespace-nowrap">{formatTimestamp(movement.createdAt)}</td>
                    <td className="p-3">{movementLabel(movement.kind)}</td>
                    <td className="p-3 tabular-nums whitespace-nowrap">
                      {formatMinutes(movement.deltaMinutes)}
                    </td>
                    <td className="p-3">
                      {movement.reason}
                      {movement.expiresAt && (
                        <span className="block text-xs">
                          {text('Validade: ', 'Expiry: ')}
                          {formatTimestamp(movement.expiresAt)}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {write &&
                        enabled &&
                        !movement.parentId &&
                        ['CREDIT', 'DEBIT', 'ADJUSTMENT'].includes(movement.kind) && (
                          <button
                            type="button"
                            className="workspace-secondary"
                            disabled={busy || reason.trim().length < 5}
                            onClick={() => {
                              void run(() =>
                                postMovement(`/api/hour-accounts/${detail.id}/reverse`, {
                                  movementId: movement.id,
                                  reason,
                                })
                              );
                            }}
                          >
                            {text('Estornar', 'Reverse')}
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
