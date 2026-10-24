import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
const mocks = vi.hoisted(() => ({ grants: vi.fn(), assigned: vi.fn(), flows: vi.fn() }));
vi.mock('../application/access-control.service.js', () => ({
  getUserGrants: mocks.grants,
  getAssignedUserGrants: mocks.assigned,
  getFlows: mocks.flows,
}));
import { authorizeRequest } from './authorization.middleware.js';

const request = (path: string, method = 'GET', body = {}) =>
  ({ user: { userId: 1, roleId: 1 }, route: { path }, method, body }) as Request;
const execute = async (req: Request) => {
  const json = vi.fn(),
    res = { json } as unknown as Response,
    next = vi.fn();
  await authorizeRequest(req, res, next);
  return { res, json, next };
};
describe('authorization boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.flows.mockResolvedValue({
      closing: true,
      sync: true,
      tokens: true,
      projects: true,
      estimates: true,
      tracking: false,
      mcp: false,
    });
  });
  it('uses action scope even when the JWT base role is administrator', async () => {
    mocks.grants.mockResolvedValue([
      { permission: 'time.write', scope: 'self' },
      { permission: 'rates.read', scope: 'all' },
    ]);
    const req = request('/api/time-entries/:id', 'PUT');
    expect((await execute(req)).next).toHaveBeenCalledWith();
    expect(req.user?.roleId).toBe(3);
  });
  it('denies unknown routes and absent grants', async () => {
    mocks.grants.mockResolvedValue([]);
    expect(
      (await execute(request('/api/new-operation', 'POST'))).next.mock.calls[0][0]
    ).toMatchObject({ statusCode: 403 });
  });
  it('projects financial and authentication secrets from nested responses', async () => {
    mocks.grants.mockResolvedValue([{ permission: 'clients.read', scope: 'all' }]);
    const { res, json } = await execute(request('/api/clients'));
    res.json({
      data: {
        name: 'Client',
        passwordHash: 'secret',
        allocations: [{ hourlyRate: 123, hoursPerDay: 8 }],
      },
    });
    expect(json).toHaveBeenCalledWith({
      data: { name: 'Client', allocations: [{ hoursPerDay: 8 }] },
    });
  });
  it('prevents people management from escalating to role administration', async () => {
    mocks.grants.mockResolvedValue([{ permission: 'people.write', scope: 'all' }]);
    expect(
      (await execute(request('/api/users/:id', 'PUT', { roleId: 1 }))).next.mock.calls[0][0]
    ).toMatchObject({ statusCode: 403 });
  });
  it('preserves numeric Prisma rates and excludes raw snapshot strings', async () => {
    mocks.grants.mockResolvedValue([
      { permission: 'clients.read', scope: 'all' },
      { permission: 'rates.read', scope: 'all' },
    ]);
    const { res, json } = await execute(request('/api/clients'));
    res.json({
      data: { hourlyRate: new Prisma.Decimal('123.45'), snapshotJson: '{"private":"data"}' },
    });
    expect(json).toHaveBeenCalledWith({ data: { hourlyRate: 123.45 } });
  });
  it('blocks a disabled flow even with its action grant', async () => {
    mocks.grants.mockResolvedValue([{ permission: 'closing.submit', scope: 'all' }]);
    mocks.flows.mockResolvedValue({ closing: false });
    expect(
      (await execute(request('/api/closing-periods/submit', 'POST'))).next.mock.calls[0][0]
    ).toMatchObject({ statusCode: 403 });
  });
  it('protects administrator credentials even when the target account is inactive', async () => {
    mocks.grants.mockResolvedValue([{ permission: 'people.write', scope: 'all' }]);
    mocks.assigned.mockResolvedValue([{ permission: 'access.manage', scope: 'all' }]);
    const req = request('/api/users/:id/password', 'PUT', { password: 'Test-only-password1!' });
    req.params = { id: '9' };
    expect((await execute(req)).next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });
  it('restricts legacy personal tokens to own entries and denies session endpoints', async () => {
    mocks.grants.mockResolvedValue([{ permission: 'time.read', scope: 'all' }]);
    const req = request('/api/time-entries');
    req.authTokenType = 'pat';
    expect((await execute(req)).next).toHaveBeenCalledWith();
    expect(req.user?.roleId).toBe(3);
    const session = request('/api/capabilities');
    session.authTokenType = 'pat';
    expect((await execute(session)).next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });
});
