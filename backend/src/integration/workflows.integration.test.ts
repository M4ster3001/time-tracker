import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../shared/infrastructure/db/prisma.js';
import { accountDetail, appendMovement, expireCredits, reverseMovement } from '../modules/hour-balances/application/hour-balance.service.js';
import { approveClosing, closeWorkspace, reviseClosing } from '../modules/month-close/application/month-close.service.js';
import { PrismaTimeEntryRepository } from '../modules/time-tracking/infrastructure/repositories/prisma-time-entry.repository.js';
import { assignGroups, saveGroup } from '../modules/access-control/application/access-control.service.js';
import { authUserRepository } from '../modules/auth/infrastructure/repositories/prisma-auth-user.repository.js';

// This suite must only run against the disposable database created by CI.
const enabled = process.env.RUN_DB_INTEGRATION === 'true';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      !/^\/(tts_validation|time_tracker_test)$/.test(url.pathname)) throw new Error('UNSAFE_INTEGRATION_DATABASE');
}
describe.skipIf(!enabled)('MySQL workflows and concurrency', () => {
  const suffix = randomUUID();
  let adminId: number, personId: number, clientId: number, secondClientId: number;
  const repository = new PrismaTimeEntryRepository();
  const actor = () => ({ userId: adminId, roleId: 1 });
  beforeAll(async () => {
    for (const role of [{ id: 1, name: 'Admin' }, { id: 2, name: 'Manager' }, { id: 3, name: 'Consultant' }]) {
      await prisma.role.upsert({ where: { id: role.id }, create: role, update: {} });
    }
    const initializers = await Promise.allSettled([0, 1].map((attempt) => authUserRepository.createAdminUser({
      name: 'Test admin', email: `admin-${attempt}-${suffix}@example.invalid`, passwordHash: 'non-login-test' })));
    const created = initializers.filter((item) => item.status === 'fulfilled');
    expect(created).toHaveLength(1);
    adminId = created[0].status === 'fulfilled' ? created[0].value.id : 0;
    personId = (await prisma.user.create({ data: { name: 'Test person', email: `person-${suffix}@example.invalid`, passwordHash: 'non-login-test', roleId: 3 } })).id;
    clientId = (await prisma.client.create({ data: { name: 'Disposable client', code: suffix, lockDay: 20 } })).id;
    secondClientId = (await prisma.client.create({ data: { name: 'Another disposable client', code: `${suffix}-2`, lockDay: 20 } })).id;
    await prisma.userClient.create({ data: { userId: personId, clientId } });
    await prisma.clientAllocationHistory.create({ data: { userId: personId, clientId, allocationType: 'DAILY',
      hoursPerDay: 1, hourlyRate: '100.00', effectiveFrom: new Date('2026-08-21') } });
  });
  afterAll(async () => {
    // Remove only fixtures owned by this suite, never truncate or reset the database.
    if (clientId) {
      const accounts = await prisma.hourAccount.findMany({ where: { OR: [{ clientId }, { userId: personId }] }, select: { id: true } });
      await prisma.hourMovement.updateMany({ where: { accountId: { in: accounts.map((item) => item.id) } }, data: { reversesId: null, expiresCreditId: null } });
      await prisma.hourMovement.deleteMany({ where: { accountId: { in: accounts.map((item) => item.id) } } });
      await prisma.hourAccount.deleteMany({ where: { id: { in: accounts.map((item) => item.id) } } });
      await prisma.closingRevision.deleteMany({ where: { period: { clientId } } });
      await prisma.closingPeriod.deleteMany({ where: { clientId } });
      await prisma.client.delete({ where: { id: clientId } });
    }
    if (adminId) await prisma.user.deleteMany({ where: { id: { in: [adminId, personId] } } });
    if (secondClientId) await prisma.client.delete({ where: { id: secondClientId } });
    await prisma.accessGroup.deleteMany({ where: { name: `test-${suffix}` } });
    await prisma.$disconnect();
  });
  it('serializes competing daily entries and rejects totals over 12 hours', async () => {
    const input = { userId: personId, clientId, date: new Date('2026-10-01'), activityDescription: 'Concurrent test', durationMinutes: 480 };
    const results = await Promise.allSettled([repository.createTimeEntry(input), repository.createTimeEntry({ ...input, clientId: secondClientId })]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect((await prisma.timeEntry.aggregate({ where: { userId: personId, date: input.date }, _sum: { durationMinutes: true } }))._sum.durationMinutes).toBe(480);
  });
  it('approves once, preserves old snapshots, requires unlock, and posts only recalculation differences', async () => {
    const entry = await repository.createTimeEntry({ userId: personId, clientId, date: new Date('2026-09-10'), durationMinutes: 61, activityDescription: 'Service delivered' });
    const pool = await prisma.hourAccount.create({ data: { kind: 'CLIENT', clientId, name: 'Contract A', ownerKey: `CLIENT:${clientId}:A` } });
    const bank = await prisma.hourAccount.create({ data: { kind: 'PERSONAL', userId: personId, name: 'Personal bank', ownerKey: `PERSONAL:${personId}`, allowNegative: true } });
    await prisma.$transaction((tx) => appendMovement(tx, { accountId: pool.id, deltaMinutes: 1000, kind: 'CREDIT', sourceKey: suffix, reason: 'Contract credit', createdBy: adminId }));
    const policy = { clientAccountId: pool.id, consume: 'BILLABLE' as const, individualBank: true };
    const input = { clientId, year: 2026, month: 9, policy, reason: 'Initial month close', expectedVersion: 0, recalculate: false };
    const submitted = await reviseClosing(actor(), input);
    await approveClosing(actor(), submitted.id, 1);
    const count = await prisma.hourMovement.count();
    await approveClosing(actor(), submitted.id, 1);
    expect(await prisma.hourMovement.count()).toBe(count);
    const first = await closeWorkspace(actor(), clientId, 2026, 9);
    expect(first.published?.lines[0].billableAmount).toBe(101.67);
    await prisma.client.update({ where: { id: clientId }, data: { lockDay: 19 } });
    const unchangedCycle = await closeWorkspace(actor(), clientId, 2026, 9);
    expect(unchangedCycle.preview.endDate.slice(0, 10)).toBe('2026-09-20');
    expect(unchangedCycle.needsRecalculation).toBe(false);
    expect((await accountDetail(actor(), pool.id)).balanceMinutes).toBe(939);
    const context = { userId: personId, date: entry.date, durationMinutes: 31, previousClientId: clientId, previousDate: entry.date, expectedUpdatedAt: entry.updatedAt };
    await expect(repository.updateTimeEntry(entry.id, { durationMinutes: 31 }, context)).rejects.toThrow('CLOSED_PERIOD_REQUIRES_TEMPORARY_UNLOCK');
    await prisma.temporaryUnlock.create({ data: { userId: personId, clientId, grantedBy: adminId, periodYear: 2026,
      periodMonth: 9, reason: 'Correction authorized', expiresAt: new Date(Date.now() + 3600000) } });
    await repository.updateTimeEntry(entry.id, { durationMinutes: 31 }, context);
    expect((await closeWorkspace(actor(), clientId, 2026, 9)).needsRecalculation).toBe(true);
    await reviseClosing(actor(), { ...input, expectedVersion: 1, recalculate: true, reason: 'Corrected time entry' });
    expect((await accountDetail(actor(), pool.id)).balanceMinutes).toBe(939);
    await approveClosing(actor(), submitted.id, 2);
    expect((await accountDetail(actor(), pool.id)).balanceMinutes).toBe(969);
    expect((await closeWorkspace(actor(), clientId, 2026, 9, 1)).published?.lines[0].workedMinutes).toBe(61);
    const current = await closeWorkspace(actor(), clientId, 2026, 9);
    expect(current.published?.lines[0].workedMinutes).toBe(31);
    expect((await accountDetail(actor(), bank.id)).balanceMinutes).toBe(31 - current.preview.lines[0].targetMinutes);
    expect(current.needsRecalculation).toBe(false);
  });
  it('rejects stale approvals and enforces a separate approver when configured', async () => {
    const workspace = await closeWorkspace(actor(), clientId, 2026, 9);
    await expect(approveClosing(actor(), workspace.period.id!, 1)).rejects.toThrow('CLOSING_VERSION_CONFLICT');
    const submitted = await reviseClosing(actor(), { clientId, year: 2026, month: 8, expectedVersion: 0, reason: 'Approval separation test',
      recalculate: false, policy: { clientAccountId: null, consume: 'BILLABLE', individualBank: false } });
    await prisma.featureSetting.upsert({ where: { key: 'independentApproval' }, create: { key: 'independentApproval', enabled: true, updatedBy: adminId }, update: { enabled: true } });
    try { await expect(approveClosing(actor(), submitted.id, 1)).rejects.toThrow('INDEPENDENT_APPROVER_REQUIRED'); }
    finally { await prisma.featureSetting.delete({ where: { key: 'independentApproval' } }); }
  });
  it('prevents overdraft under competing debits and preserves expiry when reversing a debit', async () => {
    const account = await prisma.hourAccount.create({ data: { kind: 'CLIENT', clientId, name: 'Concurrency pool', ownerKey: `CLIENT:${clientId}:B` } });
    const expiry = new Date(Date.now() + 86400000);
    await prisma.$transaction((tx) => appendMovement(tx, { accountId: account.id, deltaMinutes: 100, kind: 'CREDIT', sourceKey: `${suffix}:credit`, reason: 'Credit lot', createdBy: adminId, expiresAt: expiry }));
    const debit = (key: string) => prisma.$transaction((tx) => appendMovement(tx, { accountId: account.id, deltaMinutes: -60, kind: 'DEBIT', sourceKey: key, reason: 'Concurrent debit', createdBy: adminId }));
    const results = await Promise.allSettled([debit(`${suffix}:debit1`), debit(`${suffix}:debit2`)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const applied = results.find((result) => result.status === 'fulfilled');
    if (applied?.status !== 'fulfilled') throw new Error('Debit not applied');
    const reverse = () => prisma.$transaction((tx) => reverseMovement(tx, actor(), { accountId: account.id, movementId: applied.value.id, requestKey: suffix, reason: 'Cancel debit' }));
    await reverse(); const count = await prisma.hourMovement.count(); await reverse(); expect(await prisma.hourMovement.count()).toBe(count);
    expect((await accountDetail(actor(), account.id)).balanceMinutes).toBe(100);
    await prisma.$transaction((tx) => expireCredits(tx, account.id, new Date(expiry.getTime() + 1)));
    expect((await accountDetail(actor(), account.id)).balanceMinutes).toBe(0);
  });
  it('rolls back an attempt to remove the last access administrator', async () => {
    const group = await saveGroup(adminId, { name: `test-${suffix}`, description: '', isActive: true, grants: [{ permission: 'time.read', scope: 'self' }] });
    await expect(assignGroups(adminId, adminId, [group.id])).rejects.toThrow('LAST_ACCESS_MANAGER');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).accessMode).toBe('LEGACY');
  });
  it('recalculation never revives the validity of an already expired client credit', async () => {
    await prisma.clientAllocationHistory.create({ data: { userId: personId, clientId, allocationType: 'DAILY',
      hoursPerDay: 1, hourlyRate: '100.00', effectiveFrom: new Date('2026-06-20'), effectiveTo: new Date('2026-07-19') } });
    const entry = await repository.createTimeEntry({ userId: personId, clientId, date: new Date('2026-07-10'), durationMinutes: 60, activityDescription: 'Expiry reconciliation test' });
    const account = await prisma.hourAccount.create({ data: { kind: 'CLIENT', clientId, name: 'Expiring contract', ownerKey: `CLIENT:${clientId}:expiry` } });
    const expiry = new Date(Date.now() + 60000);
    await prisma.$transaction((tx) => appendMovement(tx, { accountId: account.id, deltaMinutes: 100, kind: 'CREDIT',
      sourceKey: `${suffix}:expiry-credit`, reason: 'Credit with validity', createdBy: adminId, expiresAt: expiry }));
    const input = { clientId, year: 2026, month: 7, expectedVersion: 0, reason: 'Expiry baseline close', recalculate: false,
      policy: { clientAccountId: account.id, consume: 'WORKED' as const, individualBank: false } };
    const first = await reviseClosing(actor(), input); await approveClosing(actor(), first.id, 1);
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(expiry.getTime() + 1000);
    try {
      expect((await accountDetail(actor(), account.id)).balanceMinutes).toBe(0);
      await prisma.temporaryUnlock.create({ data: { userId: personId, clientId, grantedBy: adminId, periodYear: 2026,
        periodMonth: 7, reason: 'Correct expired contract close', expiresAt: new Date(Date.now() + 3600000) } });
      await repository.updateTimeEntry(entry.id, { durationMinutes: 30 }, { userId: personId, date: entry.date, durationMinutes: 30,
        previousClientId: clientId, previousDate: entry.date, expectedUpdatedAt: entry.updatedAt });
      await reviseClosing(actor(), { ...input, expectedVersion: 1, recalculate: true, reason: 'Return original expiring lots' });
      await approveClosing(actor(), first.id, 2);
      expect((await accountDetail(actor(), account.id)).balanceMinutes).toBe(0);
      const returned = await prisma.hourMovement.findFirstOrThrow({ where: { accountId: account.id, kind: 'CLOSING_RETURN' } });
      expect(returned.deltaMinutes).toBe(30); expect(returned.expiresAt?.getTime()).toBe(expiry.getTime());
    } finally { vi.useRealTimers(); }
  });
});
