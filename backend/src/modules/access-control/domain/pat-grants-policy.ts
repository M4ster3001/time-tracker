import type { Grant } from './permissions.js';

/** Legacy PATs without grantsJson still intersect against this narrow self scope. */
export const DEFAULT_CONSULTANT_PAT_GRANTS: Grant[] = [
  { permission: 'time.read', scope: 'self' },
  { permission: 'time.write', scope: 'self' },
  { permission: 'clients.read', scope: 'self' },
];

export const resolvePatTokenGrants = (tokenGrants: Grant[] | null | undefined): Grant[] => {
  if (tokenGrants === undefined || tokenGrants === null) {
    return DEFAULT_CONSULTANT_PAT_GRANTS;
  }
  return tokenGrants;
};

export const assertPatGrantsProvided = (grants: Grant[] | undefined): Grant[] => {
  if (!grants || grants.length === 0) {
    throw new Error('PAT_GRANTS_REQUIRED');
  }
  return grants;
};
