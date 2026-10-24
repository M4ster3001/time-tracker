import { describe, expect, it } from 'vitest';
import { intersectGrants, legacyGrants, permissionForRoute, scopeFor } from './permissions.js';
import { navigationFor } from './navigation.js';
describe('action permissions', () => {
  it('never uses an unrelated all scope to widen time access', () => {
    expect(
      scopeFor(
        [
          { permission: 'rates.read', scope: 'all' },
          { permission: 'time.write', scope: 'self' },
        ],
        'time.write'
      )
    ).toBe('self');
  });
  it('requires both the current user grant and token grant with the narrower scope', () => {
    expect(
      intersectGrants(
        [{ permission: 'time.write', scope: 'team' }],
        [
          { permission: 'time.write', scope: 'all' },
          { permission: 'access.manage', scope: 'all' },
        ]
      )
    ).toEqual([{ permission: 'time.write', scope: 'team' }]);
  });
  it('denies unknown routes and maps approval separately from submission', () => {
    expect(permissionForRoute('/api/new-admin-action', 'POST')).toBeNull();
    expect(permissionForRoute('/api/projects', 'GET')).toBe('projects.read');
    expect(permissionForRoute('/api/projects', 'POST')).toBe('projects.write');
    expect(permissionForRoute('/api/clients/:clientId/projects', 'GET')).toBe('projects.read');
    expect(permissionForRoute('/api/projects/:id/legacy-entries', 'GET')).toBe('projects.read');
    expect(permissionForRoute('/api/projects/:id/classify-legacy-entries', 'POST')).toBe(
      'projects.write'
    );
    expect(permissionForRoute('/api/time-entries/:id/confirm-duration', 'POST')).toBe(
      'estimates.confirm'
    );
    expect(permissionForRoute('/api/time-entries/:id/duration-confirmations', 'GET')).toBe(
      'estimates.read'
    );
    expect(permissionForRoute('/api/time-entries/:id/estimate-revisions', 'GET')).toBe(
      'estimates.read'
    );
    expect(permissionForRoute('/api/time-entries/:id/estimate-history', 'GET')).toBe(
      'estimates.read'
    );
    expect(permissionForRoute('/api/tracking-sessions', 'POST')).toBe('tracking.write');
    expect(permissionForRoute('/api/tracking-sessions', 'GET')).toBe('tracking.read');
    expect(permissionForRoute('/api/mcp/tools', 'GET')).toBe('mcp.use');
    expect(permissionForRoute('/api/estimates/references', 'POST')).toBe('estimates.propose');
    expect(permissionForRoute('/api/time-entries/:id/estimation-references', 'GET')).toBe(
      'estimates.read'
    );
    expect(permissionForRoute('/api/estimates/calibration/preview', 'POST')).toBe(
      'estimates.read'
    );
    expect(permissionForRoute('/api/estimates/calibration/:id/decide', 'POST')).toBe(
      'estimation_parameters.manage'
    );
    expect(permissionForRoute('/api/estimates/calibration/policy', 'GET')).toBe('estimates.read');
    expect(permissionForRoute('/api/estimates/calibration/policy', 'PUT')).toBe(
      'estimation_parameters.manage'
    );
    expect(permissionForRoute('/api/task-types', 'GET')).toBe('estimates.read');
    expect(permissionForRoute('/api/task-types', 'POST')).toBe('estimation_parameters.manage');
    expect(permissionForRoute('/api/task-types/:id', 'PUT')).toBe('estimation_parameters.manage');
    expect(permissionForRoute('/api/task-types/:id/parameters', 'PUT')).toBe(
      'estimation_parameters.manage'
    );
    expect(permissionForRoute('/api/task-types/:id/parameter-sets', 'GET')).toBe('estimates.read');
    expect(permissionForRoute('/api/work-activities', 'POST')).toBe('estimates.propose');
    expect(permissionForRoute('/api/work-activities/:id/confirm-duration', 'POST')).toBe(
      'estimates.confirm'
    );
    expect(permissionForRoute('/api/work-activities/:id/confirm-duration-preview', 'GET')).toBe(
      'estimates.read'
    );
    expect(permissionForRoute('/api/tracking-sessions/active', 'GET')).toBe('tracking.read');
    expect(permissionForRoute('/api/tracking-sessions/import', 'POST')).toBe('tracking.write');
    expect(permissionForRoute('/api/closing-periods/:id/approve', 'POST')).toBe('closing.approve');
    expect(permissionForRoute('/api/closing-periods/recalculate', 'POST')).toBe(
      'closing.recalculate'
    );
  });
  it('hides disabled flows and shows only navigation allowed for the action', () => {
    const entries = navigationFor(legacyGrants(3), { calendar: false, tokens: false }, false);
    expect(entries.some((item) => item.path === '/access')).toBe(false);
    expect(entries.some((item) => item.path === '/calendar-import')).toBe(false);
    expect(entries.some((item) => item.path === '/time-entries')).toBe(true);
  });
});
