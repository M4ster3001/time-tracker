import type { KeyboardEvent, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import { useCapabilities } from '../../../contexts/CapabilitiesContext';
import { onTablistKeyDown } from '../../../hooks/tablistKeyboard';
import { text } from '../../../i18n';
import UsersPage from '../../admin/users';
import PeopleAllocations from '../../manager/consultants';
import ManagerAllocations from '../../admin/manager-allocations';
import TeamAllocations from '../../manager/allocations';
import ClientsPage from '../../admin/clients';
import ClientProjectsPage from '../../admin/client-projects/ClientProjectsPage';
import ClientPortfolio from '../../manager/clients';
import ReportsPage from '../../admin/reports';
import BillingPage from '../../admin/hour-pool';
import ExportPage from '../../cross-role/export';
import AccessPage from '../../admin/access/AccessPage';
import IntegrationsPage from '../../consultant/integrations';
import OrganizationTokens from '../../admin/access-tokens';
import NotificationsPage from '../../consultant/notifications';
import AuditPage from '../../admin/audit-logs';
import HealthPage from '../../admin/health';
import RetentionPage from '../../admin/retention';
import DesktopPage from '../../desktop/settings';
import CalibrationPanel from '../../admin/calibration/CalibrationPanel';
import TaskTypesPanel from '../../admin/task-types/TaskTypesPanel';
import DisplayPreferencesPanel from './DisplayPreferencesPanel';
import HelpContent from '../../../components/shell/HelpContent';

type Tab = {
  key: string;
  label: string;
  allowed: boolean;
  content: ReactNode;
  /** Optional two-level navigation: tabs sharing a group are shown under one group tab. */
  group?: string;
};

const rememberKey = (title: string) => `tt.workspaceTab.${title}`;
const readRemembered = (title: string): string | null => {
  try {
    return window.localStorage.getItem(rememberKey(title));
  } catch {
    return null;
  }
};
const writeRemembered = (title: string, tab: string) => {
  try {
    window.localStorage.setItem(rememberKey(title), tab);
  } catch {
    /* private mode / quota: remembering the tab is a convenience only */
  }
};
const groupSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const Workspace = ({
  title,
  tabs,
  rememberLastTab = false,
}: {
  title: string;
  tabs: Tab[];
  /** Reopen the last used tab when the URL has no `tab` parameter. */
  rememberLastTab?: boolean;
}) => {
  const [params, setParams] = useSearchParams();
  const allowed = tabs.filter((tab) => tab.allowed);
  const requested = params.get('tab');
  const fallbackKey = rememberLastTab ? readRemembered(title) : null;
  const byKey = (key: string | null) => allowed.find((tab) => tab.key === key);
  const selected = byKey(requested) ?? byKey(fallbackKey) ?? allowed[0];

  const grouped = allowed.some((tab) => tab.group);
  const groupOf = (tab: Tab) => tab.group ?? tab.label;
  const groupNames = grouped ? [...new Set(allowed.map(groupOf))] : [];
  const activeGroup = selected ? groupOf(selected) : null;
  const siblings =
    grouped && activeGroup ? allowed.filter((tab) => groupOf(tab) === activeGroup) : [];

  const select = (key: string, focusId?: string) => {
    setParams({ tab: key });
    if (rememberLastTab) writeRemembered(title, key);
    if (focusId) {
      window.requestAnimationFrame(() => document.getElementById(focusId)?.focus());
    }
  };
  const selectGroup = (name: string) => {
    const first = allowed.find((tab) => groupOf(tab) === name);
    if (first) select(first.key, `workspace-group-${groupSlug(name)}`);
  };

  const selectedIndex = Math.max(0, selected ? allowed.indexOf(selected) : 0);
  const flatKeyDown = (event: KeyboardEvent<HTMLDivElement>) =>
    onTablistKeyDown(event, {
      selectedIndex,
      length: allowed.length,
      selectIndex: (index) => {
        const next = allowed[index];
        if (next) select(next.key, `workspace-tab-${next.key}`);
      },
    });

  const tabButton = (tab: Tab, className = 'workspace-tab') => {
    const isSelected = selected?.key === tab.key;
    return (
      <button
        key={tab.key}
        id={`workspace-tab-${tab.key}`}
        role="tab"
        type="button"
        aria-selected={isSelected}
        aria-controls={`workspace-panel-${tab.key}`}
        tabIndex={isSelected ? 0 : -1}
        className={`${className} ${isSelected ? 'active' : ''}`}
        onClick={() => select(tab.key)}
      >
        {tab.label}
      </button>
    );
  };

  // A group with a single tab has no second row, so the panel is labelled by the group tab.
  const panelLabelledBy = !selected
    ? undefined
    : grouped && siblings.length <= 1
      ? `workspace-group-${groupSlug(groupOf(selected))}`
      : `workspace-tab-${selected.key}`;

  return (
    <AppShell title={title}>
      {grouped ? (
        <>
          <div
            className="workspace-tabs"
            role="tablist"
            aria-label={title}
            onKeyDown={(event) =>
              onTablistKeyDown(event, {
                selectedIndex: Math.max(0, groupNames.indexOf(activeGroup ?? '')),
                length: groupNames.length,
                selectIndex: (index) => selectGroup(groupNames[index]),
              })
            }
          >
            {groupNames.map((name) => {
              const isActive = name === activeGroup;
              const members = allowed.filter((tab) => groupOf(tab) === name);
              return (
                <button
                  key={name}
                  id={`workspace-group-${groupSlug(name)}`}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  aria-controls={members.length === 1 ? `workspace-panel-${members[0].key}` : undefined}
                  tabIndex={isActive ? 0 : -1}
                  className={`workspace-tab ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (!isActive) selectGroup(name);
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
          {siblings.length > 1 ? (
            <div
              className="workspace-tabs workspace-tabs--sub"
              role="tablist"
              aria-label={activeGroup ?? title}
              onKeyDown={(event) =>
                onTablistKeyDown(event, {
                  selectedIndex: Math.max(
                    0,
                    siblings.findIndex((tab) => tab.key === selected?.key)
                  ),
                  length: siblings.length,
                  selectIndex: (index) => {
                    const next = siblings[index];
                    if (next) select(next.key, `workspace-tab-${next.key}`);
                  },
                })
              }
            >
              {siblings.map((tab) => tabButton(tab, 'workspace-tab workspace-tab--sub'))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="workspace-tabs" role="tablist" aria-label={title} onKeyDown={flatKeyDown}>
          {allowed.map((tab) => tabButton(tab))}
        </div>
      )}
      {selected ? (
        <div
          key={selected.key}
          id={`workspace-panel-${selected.key}`}
          role="tabpanel"
          aria-labelledby={panelLabelledBy}
          className="mt-4"
        >
          {selected.content}
        </div>
      ) : (
        <p className="workspace-panel mt-4">
          {text('Nenhuma atividade disponível.', 'No activities available.')}
        </p>
      )}
    </AppShell>
  );
};
export function PeopleWorkspace() {
  const { can } = useCapabilities();
  return (
    <Workspace
      title={text('Pessoas e alocações', 'People and allocations')}
      tabs={[
        {
          key: 'people',
          label: text('Pessoas', 'People'),
          allowed: can('people.read', 'all'),
          content: <UsersPage />,
        },
        {
          key: 'allocations',
          label: text('Alocações', 'Allocations'),
          allowed: can('allocations.read', 'all'),
          content: <PeopleAllocations />,
        },
        {
          key: 'managers',
          label: text('Gestores', 'Managers'),
          allowed: can('allocations.read', 'all'),
          content: <ManagerAllocations />,
        },
        {
          key: 'team',
          label: text('Minha equipe', 'My team'),
          allowed: can('allocations.read', 'team') && !can('allocations.read', 'all'),
          content: <TeamAllocations />,
        },
      ]}
    />
  );
}
export function ClientsWorkspace() {
  const { can, capabilities } = useCapabilities();
  return (
    <Workspace
      title={text('Clientes', 'Clients')}
      tabs={[
        {
          key: 'directory',
          label: text('Cadastro', 'Directory'),
          allowed: can('clients.read', 'all'),
          content: <ClientsPage />,
        },
        {
          key: 'projects',
          label: text('Projetos', 'Projects'),
          allowed: Boolean(capabilities?.flows?.projects) && can('projects.read'),
          content: <ClientProjectsPage />,
        },
        {
          key: 'portfolio',
          label: text('Carteira', 'Portfolio'),
          allowed: can('clients.read', 'team') && !can('clients.read', 'all'),
          content: <ClientPortfolio />,
        },
      ]}
    />
  );
}
export function ReportsWorkspace() {
  const { can } = useCapabilities();
  return (
    <Workspace
      title={text('Relatórios', 'Reports')}
      tabs={[
        {
          key: 'analysis',
          label: text('Indicadores', 'Insights'),
          allowed: can('reports.read', 'all'),
          content: <ReportsPage />,
        },
        {
          key: 'billing',
          label: text('Faturamento', 'Billing'),
          allowed: can('rates.read', 'all'),
          content: <BillingPage />,
        },
        {
          key: 'export',
          label: text('Exportar', 'Export'),
          allowed: can('reports.export'),
          content: <ExportPage />,
        },
      ]}
    />
  );
}
function SettingsHelpTab() {
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic');
  return (
    <div className="tt-panel">
      <HelpContent
        topicId={topic}
        onSelectTopic={(id) => {
          if (!id) {
            setParams({ tab: 'help' });
            return;
          }
          setParams({ tab: 'help', topic: id });
        }}
      />
    </div>
  );
}

export function SettingsWorkspace() {
  const { can } = useCapabilities();
  const desktop = Boolean(window.desktopRuntime?.isDesktop || window.location.protocol === 'file:');
  return (
    <Workspace
      title={text('Configurações', 'Settings')}
      rememberLastTab
      tabs={[
        {
          key: 'display',
          group: text('Preferências', 'Preferences'),
          label: text('Apresentação', 'Display'),
          allowed: true,
          content: <DisplayPreferencesPanel />,
        },
        {
          key: 'access',
          group: text('Acesso', 'Access'),
          label: text('Grupos e fluxos', 'Groups and workflows'),
          allowed: can('access.manage', 'all'),
          content: <AccessPage />,
        },
        {
          key: 'task-types',
          group: text('Estimativas', 'Estimates'),
          label: text('Tipos de tarefa', 'Task types'),
          allowed:
            can('estimates.read') &&
            (can('estimation_parameters.manage') || can('estimation_parameters.manage', 'all')),
          content: <TaskTypesPanel />,
        },
        {
          key: 'calibration',
          group: text('Estimativas', 'Estimates'),
          label: text('Calibração', 'Calibration'),
          allowed:
            can('estimation_parameters.manage') || can('estimation_parameters.manage', 'all'),
          content: <CalibrationPanel />,
        },
        {
          key: 'integrations',
          group: text('Preferências', 'Preferences'),
          label: text('Integrações', 'Integrations'),
          allowed: can('tokens.manage'),
          content: <IntegrationsPage />,
        },
        {
          key: 'tokens',
          group: text('Acesso', 'Access'),
          label: text('Tokens da organização', 'Organization tokens'),
          allowed: can('tokens.manage', 'all'),
          content: <OrganizationTokens />,
        },
        {
          key: 'notifications',
          group: text('Preferências', 'Preferences'),
          label: text('Lembretes', 'Reminders'),
          allowed: can('notifications.manage'),
          content: <NotificationsPage />,
        },
        {
          key: 'audit',
          group: text('Sistema', 'System'),
          label: text('Auditoria', 'Audit log'),
          allowed: can('audit.read', 'all'),
          content: <AuditPage />,
        },
        {
          key: 'health',
          group: text('Sistema', 'System'),
          label: text('Operação', 'Operations'),
          allowed: can('operations.manage', 'all'),
          content: <HealthPage />,
        },
        {
          key: 'retention',
          group: text('Sistema', 'System'),
          label: text('Retenção', 'Retention'),
          allowed: can('operations.manage', 'all'),
          content: <RetentionPage />,
        },
        {
          key: 'desktop',
          group: text('Sistema', 'System'),
          label: text('Desktop e backup', 'Desktop and backup'),
          allowed: desktop && can('integrations.use'),
          content: <DesktopPage />,
        },
        {
          key: 'help',
          group: text('Ajuda', 'Help'),
          label: text('Ajuda', 'Help'),
          allowed: true,
          content: <SettingsHelpTab />,
        },
      ]}
    />
  );
}
