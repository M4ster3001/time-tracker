import { describe, expect, it, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  seedRun: { upsert: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({ prisma: mocks }));
import { grantsForUser, withAccessSafety } from './access-control.service.js';
describe('group safety', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.$transaction.mockImplementation((fn) => fn(mocks));
  });
  it('custom administrators with no groups receive no inherited privileges', () => {
    expect(grantsForUser({ roleId: 1, accessMode: 'CUSTOM', accessMemberships: [] })).toEqual([]);
    expect(
      grantsForUser({
        roleId: 1,
        accessMode: 'CUSTOM',
        accessMemberships: [
          { group: { isActive: false, grants: [{ permission: 'access.manage', scope: 'all' }] } },
        ],
      })
    ).toEqual([]);
  });
  it('rejects a mutation that removes the last access administrator', async () => {
    mocks.user.findMany.mockResolvedValue([
      { roleId: 1, accessMode: 'CUSTOM', accessMemberships: [] },
    ]);
    await expect(withAccessSafety(async () => 'changed')).rejects.toThrow('LAST_ACCESS_MANAGER');
    expect(mocks.seedRun.upsert).toHaveBeenCalled();
  });
  it('accepts an active custom group with organization access administration', async () => {
    mocks.user.findMany.mockResolvedValue([
      {
        roleId: 3,
        accessMode: 'CUSTOM',
        accessMemberships: [
          {
            group: {
              isActive: true,
              grants: [{ permission: 'access.manage', scope: 'all' }],
            },
          },
        ],
      },
    ]);
    await expect(withAccessSafety(async () => 'saved')).resolves.toBe('saved');
  });
});
