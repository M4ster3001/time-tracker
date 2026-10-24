import React, { useEffect, useMemo, useState } from 'react';
import EmptyState from '../../../components/EmptyState';
import StateBanner from '../../../components/StateBanner';
import SearchableSelect from '../../../components/SearchableSelect';
import { text } from '../../../i18n';
import api from '../../../services/api';
import { extractApiError } from '../../../utils/formatters';
import {
  PROJECT_MEMBERSHIP_ROLE_OPTIONS,
  membershipDisplayName,
  normalizeMembershipRoleForUi,
  sortProjectMembershipsForDisplay,
  usersEligibleForMembership,
  type ProjectMembershipRole,
  type ProjectMembershipRow,
} from './projectMembershipUi';

type UserOption = { id: number; name: string; email: string };

type Props = {
  projectId: number;
  projectLabel: string;
  canWrite: boolean;
};

const roleLabel = (role: string) => {
  const normalized = normalizeMembershipRoleForUi(role);
  return normalized === 'LEAD'
    ? text('Líder', 'Lead')
    : text('Membro', 'Member');
};

const ProjectMembershipsPanel: React.FC<Props> = ({ projectId, projectLabel, canWrite }) => {
  const [memberships, setMemberships] = useState<ProjectMembershipRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState(0);
  const [role, setRole] = useState<ProjectMembershipRole>('MEMBER');
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => sortProjectMembershipsForDisplay(memberships), [memberships]);
  const eligible = useMemo(() => usersEligibleForMembership(users, memberships), [users, memberships]);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [membershipsRes, usersRes] = await Promise.all([
        api.get(`/api/projects/${projectId}/memberships`),
        api.get('/api/users', { params: { includeInactive: false, limit: 200 } }),
      ]);
      setMemberships((membershipsRes.data.data || []) as ProjectMembershipRow[]);
      const rows = (usersRes.data.data || []) as UserOption[];
      setUsers(rows.map((u) => ({ id: u.id, name: u.name, email: u.email })));
    } catch (err) {
      setError(
        extractApiError(err, text('Falha ao carregar membros', 'Failed to load members'))
      );
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUserId(0);
    setRole('MEMBER');
    setMessage(null);
    void load();
  }, [projectId]);

  const upsert = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite || !userId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.put(`/api/projects/${projectId}/memberships`, { userId, role });
      setMessage(text('Membro salvo.', 'Member saved.'));
      setUserId(0);
      await load();
    } catch (err) {
      setError(extractApiError(err, text('Falha ao salvar membro', 'Failed to save member')));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (memberUserId: number) => {
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.delete(`/api/projects/${projectId}/memberships/${memberUserId}`);
      setMessage(text('Membro removido.', 'Member removed.'));
      await load();
    } catch (err) {
      setError(extractApiError(err, text('Falha ao remover membro', 'Failed to remove member')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="workspace-panel mt-4 p-4"
      aria-labelledby={`project-members-${projectId}`}
    >
      <h3 id={`project-members-${projectId}`} className="text-base font-semibold text-tt-text">
        {text('Membros do projeto', 'Project members')}
      </h3>
      <p className="mt-1 text-sm text-tt-text-muted">
        {text(
          'Vínculo ao projeto não concede outros clientes. Papéis: Membro (leitura) e Líder.',
          'Project membership does not grant other clients. Roles: Member (read) and Lead.'
        )}{' '}
        <span className="font-medium text-tt-text">{projectLabel}</span>
      </p>

      {error ? <StateBanner tone="error" className="mt-3" message={error} /> : null}
      {message ? <StateBanner tone="success" className="mt-3" message={message} /> : null}

      {canWrite ? (
        <form onSubmit={upsert} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
          <label className="block text-sm" htmlFor={`project-member-user-${projectId}`}>
            <span className="mb-1 block font-medium text-tt-text">
              {text('Pessoa', 'Person')}
            </span>
            <SearchableSelect
              id={`project-member-user-${projectId}`}
              value={userId}
              onChange={(value) => setUserId(Number(value))}
              className="w-full"
              options={[
                { value: 0, label: text('Selecione uma pessoa', 'Select a person') },
                ...eligible.map((u) => ({
                  value: u.id,
                  label: `${u.name} (${u.email})`,
                })),
              ]}
              placeholder={text('Selecione uma pessoa', 'Select a person')}
              searchPlaceholder={text('Buscar pessoa...', 'Search people...')}
            />
          </label>
          <label className="block text-sm" htmlFor={`project-member-role-${projectId}`}>
            <span className="mb-1 block font-medium text-tt-text">{text('Papel', 'Role')}</span>
            <select
              id={`project-member-role-${projectId}`}
              className="workspace-input w-full min-h-touch"
              value={role}
              onChange={(e) => setRole(normalizeMembershipRoleForUi(e.target.value))}
            >
              {PROJECT_MEMBERSHIP_ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {roleLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="workspace-primary min-h-touch"
            disabled={busy || !userId}
          >
            {text('Adicionar', 'Add')}
          </button>
        </form>
      ) : null}

      {loading ? (
        <StateBanner
          tone="info"
          className="mt-3"
          message={text('Carregando membros...', 'Loading members...')}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          className="mt-3"
          title={text('Nenhum membro', 'No members')}
          description={text(
            'Adicione pessoas vinculadas a este projeto quando precisar restringir o contexto de trabalho.',
            'Add people linked to this project when you need to restrict work context.'
          )}
        />
      ) : (
        <div className="tt-table-scroll mt-3">
          <table className="tt-table">
            <caption className="sr-only">
              {text('Lista de membros do projeto', 'Project members list')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{text('Pessoa', 'Person')}</th>
                <th scope="col">{text('Papel', 'Role')}</th>
                {canWrite ? <th scope="col">{text('Ações', 'Actions')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.userId}>
                  <td>
                    <div className="font-medium text-tt-text">{membershipDisplayName(row)}</div>
                    {row.user?.email ? (
                      <div className="text-xs text-tt-text-muted">{row.user.email}</div>
                    ) : null}
                  </td>
                  <td>{roleLabel(row.role)}</td>
                  {canWrite ? (
                    <td>
                      <button
                        type="button"
                        className="min-h-touch text-sm font-semibold text-tt-warning underline-offset-2 hover:underline"
                        disabled={busy}
                        onClick={() => void remove(row.userId)}
                      >
                        {text('Remover', 'Remove')}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ProjectMembershipsPanel;
