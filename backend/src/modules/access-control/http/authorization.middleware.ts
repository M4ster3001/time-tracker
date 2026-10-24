import type { RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../../../app/errors/app-error.js';
import {
  getAssignedUserGrants,
  getFlows,
  getUserGrants,
} from '../application/access-control.service.js';
import {
  intersectGrants,
  permissionForRoute,
  scopeFor,
  scopeCovers,
  type Grant,
} from '../domain/permissions.js';
import { resolvePatTokenGrants } from '../domain/pat-grants-policy.js';

const scrub = (value: unknown, financial: boolean): unknown => {
  if (value instanceof Date || value == null) return value;
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map((item) => scrub(item, financial));
  if (typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          ![
            'passwordHash',
            'tokenHash',
            'failedLoginAttempts',
            'lockedUntil',
            'lastFailedLoginAt',
            'snapshotJson',
          ].includes(key) &&
          (financial ||
            ![
              'hourlyRate',
              'billableAmount',
              'totalAmount',
              'totalCost',
              'details',
              'detailsJson',
              'previousData',
              'newData',
            ].includes(key))
      )
      .map(([key, item]) => [key, scrub(item, financial)])
  );
};

export const authorizeRequest: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const user = req.user;
    let grants = await getUserGrants(user.userId);
    if (req.authTokenType === 'pat') {
      grants = intersectGrants(grants, resolvePatTokenGrants(user.tokenGrants));
    }
    req.accessGrants = grants;
    req.authenticatedRoleId = user.roleId;
    const flows = await getFlows();
    const path = String(req.route?.path ?? '');
    const permission = permissionForRoute(path, req.method);
    const sessionRoute = [
      '/api/auth/me',
      '/api/auth/logout',
      '/api/capabilities',
      '/api/preferences',
    ].includes(path);
    const scope = permission ? scopeFor(grants, permission) : null;
    if (!sessionRoute && !scope) throw new ForbiddenError('PERMISSION_DENIED');
    if (
      path.includes('/export') &&
      !scopeCovers(scopeFor(grants, 'reports.export'), scope ?? 'self')
    ) {
      throw new ForbiddenError('EXPORT_PERMISSION_REQUIRED');
    }
    if ((permission === 'access.manage' || permission === 'operations.manage') && scope !== 'all') {
      throw new ForbiddenError('ORGANIZATION_SCOPE_REQUIRED');
    }
    if (req.authTokenType === 'pat' && sessionRoute) throw new ForbiddenError('TOKEN_SCOPE_DENIED');
    if (
      permission === 'people.write' &&
      (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'roleId') ||
        path.endsWith('/bulk-import')) &&
      scopeFor(grants, 'access.manage') !== 'all'
    )
      throw new ForbiddenError('ACCESS_MANAGEMENT_REQUIRED');
    if (permission === 'people.write' && scopeFor(grants, 'access.manage') !== 'all') {
      const targets = [
        req.params?.id,
        ...(Array.isArray(req.body?.userIds) ? req.body.userIds : []),
      ]
        .map(Number)
        .filter((id) => Number.isSafeInteger(id) && id > 0);
      for (const id of new Set(targets))
        if (scopeFor(await getAssignedUserGrants(id), 'access.manage') === 'all') {
          throw new ForbiddenError('PRIVILEGED_ACCOUNT_REQUIRES_ACCESS_MANAGEMENT');
        }
    }
    if (
      (path.startsWith('/api/google-calendar') && !path.endsWith('/status') && !flows.calendar) ||
      (path.startsWith('/api/ai') && !path.endsWith('/status') && !flows.ai) ||
      (/\/access-tokens/.test(path) && req.method === 'POST' && !flows.tokens) ||
      (path.startsWith('/api/sync') && !flows.sync) ||
      (path.startsWith('/api/closing-periods') && req.method !== 'GET' && !flows.closing) ||
      ((path.startsWith('/api/projects') || /\/projects(?:$|\/)/.test(path)) && !flows.projects) ||
      ((path.startsWith('/api/estimates') ||
        path.startsWith('/api/task-types') ||
        path.startsWith('/api/work-activities') ||
        /confirm-duration|duration-confirmations|estimate-revisions|estimate-history|estimation-references/.test(
          path
        )) &&
        !flows.estimates) ||
      (path.startsWith('/api/tracking-sessions') && !flows.tracking) ||
      (path.startsWith('/api/mcp') && !flows.mcp)
    ) {
      throw new ForbiddenError('FLOW_DISABLED');
    }
    if (
      req.body &&
      typeof req.body === 'object' &&
      Object.prototype.hasOwnProperty.call(req.body, 'hourlyRate') &&
      !scopeCovers(scopeFor(grants, 'rates.write'), scope ?? 'self')
    )
      throw new ForbiddenError('FINANCIAL_PERMISSION_REQUIRED');
    const json = res.json.bind(res);
    res.json = ((body: unknown) =>
      json(
        scrub(body, scopeCovers(scopeFor(grants, 'rates.read'), scope ?? 'self'))
      )) as typeof res.json;
    // Existing domain policies continue to enforce real owner/team relationships.
    // The effective role is derived only from the grant for this action.
    if (!sessionRoute && scope) {
      const personal =
        path === '/api/dashboards/consultant' || path.startsWith('/api/notifications');
      req.user = { ...user, roleId: personal || scope === 'self' ? 3 : scope === 'team' ? 2 : 1 };
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const getRequestGrants = (value: Grant[] | undefined): Grant[] => value ?? [];
