export const permissionKeys = [
  'time.read',
  'time.write',
  'dashboard.read',
  'clients.read',
  'clients.write',
  'projects.read',
  'projects.write',
  'estimates.read',
  'estimates.propose',
  'estimates.confirm',
  'estimation_parameters.manage',
  'tracking.read',
  'tracking.write',
  'mcp.use',
  'mcp.manage',
  'people.read',
  'people.write',
  'allocations.read',
  'allocations.write',
  'rates.read',
  'rates.write',
  'reports.read',
  'reports.export',
  'closing.read',
  'closing.submit',
  'closing.approve',
  'closing.recalculate',
  'balances.read',
  'balances.write',
  'integrations.use',
  'tokens.manage',
  'notifications.manage',
  'audit.read',
  'operations.manage',
  'access.manage',
] as const;
export type Permission = (typeof permissionKeys)[number];
export type Scope = 'self' | 'team' | 'all';
export type Grant = { permission: Permission; scope: Scope };
const rank = { self: 0, team: 1, all: 2 };
export const scopeCovers = (scope: Scope | null, required: Scope): boolean =>
  scope !== null && rank[scope] >= rank[required];

export const legacyGrants = (roleId: number): Grant[] => {
  if (roleId === 1) return permissionKeys.map((permission) => ({ permission, scope: 'all' }));
  const own: Permission[] = [
    'time.read',
    'time.write',
    'dashboard.read',
    'clients.read',
    'projects.read',
    'estimates.read',
    'estimates.propose',
    'estimates.confirm',
    'tracking.read',
    'tracking.write',
    'mcp.use',
    'reports.export',
    'integrations.use',
    'tokens.manage',
    'notifications.manage',
    'balances.read',
  ];
  const grants: Grant[] = own.map((permission) => ({ permission, scope: 'self' }));
  if (roleId === 2) {
    for (const permission of [
      'time.read',
      'time.write',
      'dashboard.read',
      'clients.read',
      'clients.write',
      'projects.read',
      'projects.write',
      'estimates.read',
      'estimates.propose',
      'estimation_parameters.manage',
      'tracking.read',
      'mcp.use',
      'people.read',
      'allocations.read',
      'allocations.write',
      'rates.read',
      'rates.write',
      'closing.read',
      'closing.submit',
      'reports.read',
      'reports.export',
      'balances.read',
    ] as Permission[]) {
      grants.push({ permission, scope: 'team' });
    }
  }
  return grants;
};

export const scopeFor = (grants: Grant[], permission: Permission): Scope | null => {
  const scopes = grants
    .filter((grant) => grant.permission === permission)
    .map((grant) => grant.scope);
  return scopes.reduce<Scope | null>(
    (best, scope) => (!best || rank[scope] > rank[best] ? scope : best),
    null
  );
};

export const intersectGrants = (userGrants: Grant[], tokenGrants: Grant[]): Grant[] =>
  tokenGrants.flatMap((token) => {
    const userScope = scopeFor(userGrants, token.permission);
    return userScope
      ? [
          {
            permission: token.permission,
            scope: rank[userScope] < rank[token.scope] ? userScope : token.scope,
          },
        ]
      : [];
  });

export const isGrant = (value: unknown): value is Grant => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    permissionKeys.includes(item.permission as Permission) &&
    ['self', 'team', 'all'].includes(String(item.scope))
  );
};

export const permissionForRoute = (path: string, method: string): Permission | null => {
  const read = method === 'GET' || method === 'HEAD';
  if (/^\/api\/access-control/.test(path)) return 'access.manage';
  if (/^\/api\/(?:capabilities|preferences)/.test(path)) return 'dashboard.read';
  if (/^\/api\/auth\/(?:me|logout)$/.test(path)) return 'dashboard.read';
  if (/^\/api\/auth\/(?:unlock|revoke)/.test(path)) return 'people.write';
  if (/^\/api\/closing-periods/.test(path)) {
    if (read) return 'closing.read';
    if (path.endsWith('/approve')) return 'closing.approve';
    if (path.endsWith('/recalculate')) return 'closing.recalculate';
    return 'closing.submit';
  }
  if (/^\/api\/hour-accounts/.test(path)) return read ? 'balances.read' : 'balances.write';
  if (/^\/api\/time-entries/.test(path)) {
    if (/confirm-duration/.test(path)) return 'estimates.confirm';
    if (
      /duration-confirmations|estimate-revisions|estimate-history|estimation-references/.test(
        path
      )
    ) {
      return 'estimates.read';
    }
    return read || /lock-status/.test(path) ? 'time.read' : 'time.write';
  }
  if (/\/allocations/.test(path)) return read ? 'allocations.read' : 'allocations.write';
  if (/^\/api\/users\/:id\/clients$/.test(path)) return read ? 'clients.read' : 'people.write';
  if (/^\/api\/(?:users|admin\/users)/.test(path)) return read ? 'people.read' : 'people.write';
  if (/^\/api\/manager\/consultants/.test(path)) return 'people.read';
  if (/^\/api\/projects/.test(path) || /\/projects$/.test(path))
    return read ? 'projects.read' : 'projects.write';
  if (/^\/api\/task-types/.test(path)) {
    return read ? 'estimates.read' : 'estimation_parameters.manage';
  }
  if (/^\/api\/estimates\/preview/.test(path)) return 'estimates.propose';
  if (/^\/api\/estimates\/references/.test(path)) return read ? 'estimates.read' : 'estimates.propose';
  if (/^\/api\/estimates\/calibration\/.+\/decide$/.test(path))
    return 'estimation_parameters.manage';
  if (/^\/api\/estimates\/calibration\/policy$/.test(path))
    return read ? 'estimates.read' : 'estimation_parameters.manage';
  if (/^\/api\/estimates\/calibration/.test(path)) return 'estimates.read';
  if (/^\/api\/work-activities/.test(path)) {
    if (/confirm-duration/.test(path)) {
      return read ? 'estimates.read' : 'estimates.confirm';
    }
    return read ? 'estimates.read' : 'estimates.propose';
  }
  if (/^\/api\/estimates/.test(path)) return read ? 'estimates.read' : 'estimates.propose';
  if (/^\/api\/tracking-sessions/.test(path)) return read ? 'tracking.read' : 'tracking.write';
  if (/^\/api\/mcp/.test(path)) return read ? 'mcp.use' : 'mcp.use';
  if (/^\/api\/(?:clients|manager\/clients)/.test(path))
    return read ? 'clients.read' : 'clients.write';
  if (/^\/api\/dashboards/.test(path)) return 'dashboard.read';
  if (/^\/api\/admin\/reports\/hour-pool/.test(path)) return 'rates.read';
  if (/^\/api\/admin\/reports/.test(path)) return 'reports.read';
  if (/^\/api\/export/.test(path)) return 'reports.export';
  if (/^\/api\/(?:google-calendar|ai|activity-tags)/.test(path)) return 'integrations.use';
  if (/^\/api\/notifications/.test(path)) return 'notifications.manage';
  if (/^\/api\/(?:access-tokens|admin\/access-tokens)/.test(path)) return 'tokens.manage';
  if (/^\/api\/audit-logs/.test(path)) return 'audit.read';
  if (/^\/api\/admin\/temporary-unlocks/.test(path)) return 'closing.recalculate';
  if (/^\/api\/admin\/(?:health|jobs|retention|backup)/.test(path)) return 'operations.manage';
  if (/^\/api\/sync/.test(path)) return read ? 'time.read' : 'time.write';
  if (/^\/api\/desktop\/backups/.test(path)) return 'operations.manage';
  if (/^\/api\/desktop/.test(path)) return 'integrations.use';
  return null;
};
