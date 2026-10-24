import { scopeFor, type Grant, type Permission } from './permissions.js';

type Entry = {
  path: string;
  label: string;
  labelEn: string;
  section: string;
  permission: Permission;
  minimum?: 'team' | 'all';
  flow?: string;
};
const entries: Entry[] = [
  {
    path: '/dashboard',
    label: 'Início',
    labelEn: 'Home',
    section: 'home',
    permission: 'dashboard.read',
  },
  {
    path: '/dashboard/team',
    label: 'Equipe',
    labelEn: 'Team',
    section: 'home',
    permission: 'dashboard.read',
    minimum: 'team',
  },
  {
    path: '/time-entries',
    label: 'Histórico',
    labelEn: 'History',
    section: 'hours',
    permission: 'time.read',
  },
  {
    path: '/time-entries/new',
    label: 'Lançar horas',
    labelEn: 'Log time',
    section: 'hours',
    permission: 'time.write',
  },
  {
    path: '/time-entries/bulk',
    label: 'Lançamento em lote',
    labelEn: 'Bulk entry',
    section: 'hours',
    permission: 'time.write',
  },
  {
    path: '/calendar-import',
    label: 'Importar calendário',
    labelEn: 'Import calendar',
    section: 'hours',
    permission: 'integrations.use',
    flow: 'calendar',
  },
  {
    path: '/time-entries/corrections',
    label: 'Correções',
    labelEn: 'Corrections',
    section: 'hours',
    permission: 'time.write',
    minimum: 'team',
  },
  {
    path: '/closing',
    label: 'Fechamento',
    labelEn: 'Month close',
    section: 'closing',
    permission: 'closing.read',
    minimum: 'team',
  },
  {
    path: '/balances',
    label: 'Saldos de horas',
    labelEn: 'Hour balances',
    section: 'closing',
    permission: 'balances.read',
  },
  {
    path: '/admin/temporary-unlocks',
    label: 'Desbloqueios',
    labelEn: 'Temporary unlocks',
    section: 'closing',
    permission: 'closing.recalculate',
    minimum: 'all',
  },
  {
    path: '/admin/users',
    label: 'Pessoas',
    labelEn: 'People',
    section: 'directory',
    permission: 'people.read',
    minimum: 'all',
  },
  {
    path: '/admin/clients',
    label: 'Clientes',
    labelEn: 'Clients',
    section: 'directory',
    permission: 'clients.read',
    minimum: 'all',
  },
  {
    path: '/manager/clients',
    label: 'Carteira de clientes',
    labelEn: 'Client portfolio',
    section: 'directory',
    permission: 'clients.read',
    minimum: 'team',
  },
  {
    path: '/manager/consultants',
    label: 'Alocação da equipe',
    labelEn: 'Team allocation',
    section: 'directory',
    permission: 'allocations.read',
    minimum: 'team',
  },
  {
    path: '/admin/consultants',
    label: 'Alocação de pessoas',
    labelEn: 'People allocation',
    section: 'directory',
    permission: 'allocations.read',
    minimum: 'all',
  },
  {
    path: '/admin/managers',
    label: 'Alocação de gestores',
    labelEn: 'Manager allocation',
    section: 'directory',
    permission: 'allocations.read',
    minimum: 'all',
  },
  {
    path: '/admin/bulk',
    label: 'Operações em massa',
    labelEn: 'Bulk operations',
    section: 'directory',
    permission: 'people.write',
    minimum: 'all',
  },
  {
    path: '/admin/reports',
    label: 'Relatórios',
    labelEn: 'Reports',
    section: 'reports',
    permission: 'reports.read',
    minimum: 'all',
  },
  {
    path: '/admin/hour-pool',
    label: 'Faturamento de horas',
    labelEn: 'Time billing',
    section: 'reports',
    permission: 'rates.read',
    minimum: 'all',
  },
  {
    path: '/export',
    label: 'Exportar',
    labelEn: 'Export',
    section: 'reports',
    permission: 'reports.export',
  },
  {
    path: '/access',
    label: 'Grupos e fluxos',
    labelEn: 'Groups and workflows',
    section: 'settings',
    permission: 'access.manage',
    minimum: 'all',
  },
  {
    path: '/integrations',
    label: 'Integrações',
    labelEn: 'Integrations',
    section: 'settings',
    permission: 'tokens.manage',
    flow: 'tokens',
  },
  {
    path: '/notifications',
    label: 'Notificações',
    labelEn: 'Notifications',
    section: 'settings',
    permission: 'notifications.manage',
  },
  {
    path: '/admin/access-tokens',
    label: 'Tokens da organização',
    labelEn: 'Organization tokens',
    section: 'settings',
    permission: 'tokens.manage',
    minimum: 'all',
    flow: 'tokens',
  },
  {
    path: '/admin/audit',
    label: 'Auditoria',
    labelEn: 'Audit log',
    section: 'settings',
    permission: 'audit.read',
    minimum: 'all',
  },
  {
    path: '/admin/health',
    label: 'Saúde do sistema',
    labelEn: 'System health',
    section: 'settings',
    permission: 'operations.manage',
    minimum: 'all',
  },
  {
    path: '/admin/retention',
    label: 'Retenção de dados',
    labelEn: 'Data retention',
    section: 'settings',
    permission: 'operations.manage',
    minimum: 'all',
  },
];

/** Personal operator paths — not useful for pure sysadmin (roleId 1). Correções stays. */
const ADMIN_SELF_OPERATOR_PATHS = new Set([
  '/time-entries',
  '/time-entries/new',
  '/time-entries/bulk',
]);

export type NavigationOptions = {
  roleId?: number;
  /** When true, admin also acts as consultant — keep self time-entry nav. */
  dualConsultantIntent?: boolean;
};

const isPureAdminNav = (options?: NavigationOptions): boolean =>
  options?.roleId === 1 && !options.dualConsultantIntent;

export const navigationFor = (
  grants: Grant[],
  flows: Record<string, boolean>,
  desktop: boolean,
  options?: NavigationOptions
) => {
  const result = entries.filter((entry) => {
    const scope = scopeFor(grants, entry.permission);
    if (
      !(
        scope &&
        (!entry.flow || flows[entry.flow]) &&
        (!entry.minimum || scope === 'all' || (entry.minimum === 'team' && scope === 'team'))
      )
    ) {
      return false;
    }
    if (isPureAdminNav(options) && ADMIN_SELF_OPERATOR_PATHS.has(entry.path)) {
      return false;
    }
    return true;
  });
  if (desktop && scopeFor(grants, 'integrations.use'))
    result.push({
      path: '/settings',
      label: 'Sincronização e backup',
      labelEn: 'Sync and backup',
      section: 'settings',
      permission: 'integrations.use',
    });
  const destinations: Record<string, { path: string; label: string; labelEn: string }> = {
    directory: { path: '/people', label: 'Pessoas e alocações', labelEn: 'People and allocations' },
    clients: { path: '/clients', label: 'Clientes', labelEn: 'Clients' },
    reports: { path: '/reports', label: 'Relatórios', labelEn: 'Reports' },
    settings: { path: '/settings', label: 'Configurações', labelEn: 'Settings' },
  };
  return [
    ...new Map(
      result.map((entry) => {
        const key = ['/admin/clients', '/manager/clients'].includes(entry.path)
          ? 'clients'
          : entry.section === 'directory' && entry.path !== '/admin/bulk'
            ? 'directory'
            : ['settings', 'reports'].includes(entry.section)
              ? entry.section
              : '';
        const next = key ? { ...entry, ...destinations[key] } : entry;
        return [next.path, next];
      })
    ).values(),
  ];
};
