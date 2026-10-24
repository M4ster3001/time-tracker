import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import api from '../../../services/api';
import { useCapabilities, type Grant } from '../../../contexts/CapabilitiesContext';
import { text, useLocale } from '../../../i18n';
import { extractApiError } from '../../../utils/formatters';

type Group = { id: number; name: string; description: string; isActive: boolean; grants: Grant[] };
type Person = {
  id: number;
  name: string;
  email: string;
  accessMode: string;
  accessMemberships: Array<{ groupId: number }>;
};
type Data = {
  groups: Group[];
  users: Person[];
  flows: Record<string, boolean>;
  permissions: string[];
};
const permissionNames: Record<string, [string, string]> = {
  'time.read': ['Consultar horas', 'Read time entries'],
  'time.write': ['Registrar e corrigir horas', 'Write and correct time'],
  'dashboard.read': ['Consultar indicadores', 'Read dashboards'],
  'clients.read': ['Consultar clientes', 'Read clients'],
  'clients.write': ['Gerenciar clientes', 'Manage clients'],
  'projects.read': ['Consultar projetos', 'Read projects'],
  'projects.write': ['Gerenciar projetos', 'Manage projects'],
  'estimates.read': ['Consultar estimativas', 'Read estimates'],
  'estimates.propose': ['Propor estimativas', 'Propose estimates'],
  'estimates.confirm': ['Confirmar duração', 'Confirm duration'],
  'estimation_parameters.manage': [
    'Gerenciar parâmetros de estimativa',
    'Manage estimation parameters',
  ],
  'people.read': ['Consultar pessoas', 'Read people'],
  'people.write': ['Gerenciar pessoas', 'Manage people'],
  'allocations.read': ['Consultar alocações', 'Read allocations'],
  'allocations.write': ['Gerenciar alocações', 'Manage allocations'],
  'rates.read': ['Consultar valores financeiros', 'Read financial values'],
  'rates.write': ['Alterar tarifas', 'Change rates'],
  'reports.read': ['Consultar relatórios', 'Read reports'],
  'reports.export': ['Exportar relatórios', 'Export reports'],
  'closing.read': ['Consultar fechamento', 'Read month close'],
  'closing.submit': ['Enviar fechamento', 'Submit month close'],
  'closing.approve': ['Aprovar fechamento', 'Approve month close'],
  'closing.recalculate': ['Desbloquear e recalcular', 'Unlock and recalculate'],
  'balances.read': ['Consultar saldos', 'Read hour balances'],
  'balances.write': ['Movimentar saldos', 'Manage hour balances'],
  'integrations.use': ['Usar integrações', 'Use integrations'],
  'tokens.manage': ['Gerenciar tokens', 'Manage access tokens'],
  'notifications.manage': ['Configurar lembretes', 'Configure reminders'],
  'audit.read': ['Consultar auditoria', 'Read audit log'],
  'operations.manage': ['Operar sistema e backups', 'Manage system and backups'],
  'access.manage': ['Administrar grupos e fluxos', 'Administer access and workflows'],
};
const flowNames: Record<string, [string, string]> = {
  calendar: ['Importação de calendário', 'Calendar import'],
  ai: ['Sugestões de atividades', 'Activity suggestions'],
  tokens: ['Tokens de integração', 'Integration tokens'],
  sync: ['Sincronização desktop', 'Desktop sync'],
  clientHourPool: ['Bolsão por cliente', 'Client hour pool'],
  personalHourBank: ['Banco individual', 'Personal hour bank'],
  closing: ['Aprovação de fechamento', 'Month-close approval'],
  independentApproval: ['Exigir outro aprovador', 'Require another approver'],
  publicRegistration: ['Cadastro público', 'Public registration'],
  projects: ['Projetos por cliente', 'Client projects'],
  estimates: ['Estimativas explicáveis', 'Explainable estimates'],
};
const label = (labels: Record<string, [string, string]>, key: string) =>
  labels[key] ? text(...labels[key]) : key;

export default function AccessPage() {
  useLocale();
  const { refresh } = useCapabilities();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState('groups');
  const [group, setGroup] = useState<Partial<Group>>({
    name: '',
    description: '',
    isActive: true,
    grants: [],
  });
  const [personId, setPersonId] = useState('');
  const [memberships, setMemberships] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    setData((await api.get('/api/access-control')).data.data as Data);
  };
  useEffect(() => {
    void load().catch((err) =>
      setError(
        extractApiError(err, text('Falha ao carregar acessos.', 'Unable to load access settings.'))
      )
    );
  }, []);
  useEffect(() => {
    setMemberships(
      data?.users
        .find((person) => person.id === Number(personId))
        ?.accessMemberships.map((item) => item.groupId) ?? []
    );
  }, [personId, data]);
  const save = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await load();
      await refresh();
      setMessage(text('Alterações salvas.', 'Changes saved.'));
    } catch (err) {
      setError(
        extractApiError(err, text('Falha ao salvar acessos.', 'Unable to save access settings.'))
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppShell
      title={text('Grupos e fluxos', 'Groups and workflows')}
      subtitle={text(
        'Defina quem pode fazer cada ação e quais fluxos ficam disponíveis.',
        'Choose who can perform each action and which workflows are available.'
      )}
    >
      <div className="workspace-tabs" role="tablist">
        {(['groups', 'people', 'flows'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'workspace-tab active' : 'workspace-tab'}
            onClick={() => setTab(key)}
          >
            {key === 'groups'
              ? text('Grupos', 'Groups')
              : key === 'people'
                ? text('Pessoas', 'People')
                : text('Fluxos', 'Workflows')}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="workspace-success">
          {message}
        </p>
      )}
      {!data ? (
        <p role="status">{text('Carregando...', 'Loading...')}</p>
      ) : (
        <>
          {tab === 'groups' && (
            <form
              className="workspace-panel space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void save(() => api.post('/api/access-control/groups', group));
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="workspace-label">
                  {text('Grupo', 'Group')}
                  <select
                    className="workspace-input"
                    value={group.id ?? ''}
                    onChange={(event) => {
                      setGroup(
                        data.groups.find((item) => item.id === Number(event.target.value)) ?? {
                          name: '',
                          description: '',
                          isActive: true,
                          grants: [],
                        }
                      );
                    }}
                  >
                    <option value="">{text('Criar novo grupo', 'Create a group')}</option>
                    {data.groups.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="workspace-label">
                  {text('Nome', 'Name')}
                  <input
                    required
                    maxLength={100}
                    className="workspace-input"
                    value={group.name ?? ''}
                    onChange={(event) => setGroup({ ...group, name: event.target.value })}
                  />
                </label>
              </div>
              <label className="workspace-label">
                {text('Descrição', 'Description')}
                <input
                  className="workspace-input"
                  maxLength={190}
                  value={group.description ?? ''}
                  onChange={(event) => setGroup({ ...group, description: event.target.value })}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={group.isActive ?? true}
                  onChange={(event) => setGroup({ ...group, isActive: event.target.checked })}
                />
                {text('Grupo ativo', 'Active group')}
              </label>
              <p className="text-sm text-tt-text-muted">
                {text(
                  'Sem concessão, a ação fica bloqueada. Escopo de equipe respeita os vínculos de gestão.',
                  'Actions without a grant are blocked. Team scope respects management relationships.'
                )}
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                {data.permissions.map((permission) => (
                  <label
                    className="flex items-center justify-between gap-3 rounded-xl border border-tt-border p-3"
                    key={permission}
                  >
                    <span className="text-sm">{label(permissionNames, permission)}</span>
                    <select
                      aria-label={label(permissionNames, permission)}
                      className="workspace-input !mt-0 !w-auto"
                      value={
                        group.grants?.find((grant) => grant.permission === permission)?.scope ?? ''
                      }
                      onChange={(event) =>
                        setGroup({
                          ...group,
                          grants: [
                            ...(group.grants ?? []).filter(
                              (grant) => grant.permission !== permission
                            ),
                            ...(event.target.value
                              ? [{ permission, scope: event.target.value as Grant['scope'] }]
                              : []),
                          ],
                        })
                      }
                    >
                      <option value="">{text('Bloqueado', 'Blocked')}</option>
                      <option value="self">{text('Próprio', 'Own')}</option>
                      <option value="team">{text('Equipe', 'Team')}</option>
                      <option value="all">{text('Toda a organização', 'Organization')}</option>
                    </select>
                  </label>
                ))}
              </div>
              <button className="workspace-primary" disabled={busy}>
                {busy ? text('Salvando...', 'Saving...') : text('Salvar grupo', 'Save group')}
              </button>
            </form>
          )}
          {tab === 'people' && (
            <section className="workspace-panel space-y-5">
              <label className="workspace-label">
                {text('Pessoa', 'Person')}
                <select
                  className="workspace-input"
                  value={personId}
                  onChange={(event) => setPersonId(event.target.value)}
                >
                  <option value="">{text('Selecione uma pessoa', 'Select a person')}</option>
                  {data.users.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} — {person.email}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-tt-text-muted">
                {text(
                  'Ao salvar, os grupos escolhidos substituem as permissões do perfil anterior. Nenhum grupo significa nenhum acesso a operações.',
                  'Saving replaces legacy profile permissions with the selected groups. No groups means no operational permissions.'
                )}
              </p>
              {personId && (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    {data.groups.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-tt-border p-4"
                      >
                        <input
                          type="checkbox"
                          checked={memberships.includes(item.id)}
                          onChange={(event) =>
                            setMemberships(
                              event.target.checked
                                ? [...memberships, item.id]
                                : memberships.filter((id) => id !== item.id)
                            )
                          }
                        />
                        <span>
                          {item.name}
                          {!item.isActive && ` (${text('inativo', 'inactive')})`}
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    className="workspace-primary"
                    disabled={busy}
                    onClick={() => {
                      void save(() =>
                        api.put('/api/access-control/memberships', {
                          userId: Number(personId),
                          groupIds: memberships,
                        })
                      );
                    }}
                  >
                    {text('Salvar acessos', 'Save access')}
                  </button>
                </>
              )}
            </section>
          )}
          {tab === 'flows' && (
            <section className="workspace-panel space-y-4">
              <p className="text-sm text-tt-text-muted">
                {text(
                  'Desativar um fluxo bloqueia novas operações. Dados históricos permanecem disponíveis conforme a permissão. Calendário e sugestões também dependem da configuração da instalação.',
                  'Disabling a workflow blocks new operations. Historical data remains subject to permissions. Calendar and suggestions also depend on installation configuration.'
                )}
              </p>
              {Object.entries(data.flows).map(([key, enabled]) => (
                <label
                  className="flex items-center justify-between rounded-xl border border-tt-border p-4"
                  key={key}
                >
                  <span>{label(flowNames, key)}</span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) =>
                      setData({ ...data, flows: { ...data.flows, [key]: event.target.checked } })
                    }
                  />
                </label>
              ))}
              <button
                className="workspace-primary"
                disabled={busy}
                onClick={() => {
                  void save(() =>
                    api.put(
                      '/api/access-control/flows',
                      Object.entries(data.flows).map(([key, enabled]) => ({ key, enabled }))
                    )
                  );
                }}
              >
                {text('Salvar fluxos', 'Save workflows')}
              </button>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
