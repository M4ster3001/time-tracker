import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../app/errors/app-error.js';
import { getClosingPeriodRangeUTC, normalizeDateOnly } from '../../../shared/domain/date.js';
import { computeCycleSummaryForUser } from '../../../shared/domain/policies/closing-cycle.policy.js';
import { resolveLockDay } from '../../time-tracking/domain/policies/time-entry-lock.policy.js';
import {
  appendMovement,
  expireCredits,
  lockAccount,
  type BalanceActor,
} from '../../hour-balances/application/hour-balance.service.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import { closingEligibleMinutes } from '../../../shared/domain/duration-contract.js';

type Tx = Prisma.TransactionClient;
export type ClosePolicy = {
  clientAccountId: number | null;
  consume: 'WORKED' | 'BILLABLE';
  individualBank: boolean;
};
export type CloseLine = {
  userId: number;
  name: string;
  workedMinutes: number;
  targetMinutes: number;
  overtimeMinutes: number;
  billableMinutes: number;
  hourlyRate: number | null;
  billableAmount: number | null;
  issues: string[];
};
export type CloseSnapshot = {
  clientId: number;
  clientName: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  policy: ClosePolicy;
  lines: CloseLine[];
  source: {
    lockDay: number;
    paysOvertime: boolean;
    entries: unknown[];
    allocationHistory: unknown[];
    currentAllocations: unknown[];
  };
};
const hash = (snapshot: CloseSnapshot): string =>
  createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

export const createPreview = async (
  tx: Tx,
  clientId: number,
  year: number,
  month: number,
  policy: ClosePolicy,
  storedLockDay?: number
): Promise<CloseSnapshot> => {
  const client = await tx.client.findUnique({ where: { id: clientId } });
  if (!client) throw new NotFoundError('Client not found');
  const lockDay = storedLockDay ?? resolveLockDay(client.lockDay) ?? 31;
  const { start, end } = getClosingPeriodRangeUTC(year, month, lockDay);
  const [entries, history, current] = await Promise.all([
    tx.timeEntry.findMany({
      where: { clientId, date: { gte: start, lte: end }, deletedAt: null },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    }),
    tx.clientAllocationHistory.findMany({
      where: {
        clientId,
        effectiveFrom: { lte: end },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ effectiveFrom: 'asc' }, { id: 'asc' }],
    }),
    tx.clientAllocation.findMany({
      where: { clientId, createdAt: { lte: end } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { id: 'asc' },
    }),
  ]);
  const fallback = current.filter((row) => !history.some((item) => item.userId === row.userId));
  const people = new Map(
    [...entries, ...history, ...fallback].map((row) => [row.user.id, row.user])
  );
  const lines: CloseLine[] = [];
  for (const person of [...people.values()].sort((a, b) => a.id - b.id)) {
    const own = entries.filter((entry) => entry.userId === person.id);
    const historical = history.filter((allocation) => allocation.userId === person.id);
    const legacy = current.find((allocation) => allocation.userId === person.id);
    // An unversioned current rate must never silently reprice an old period.
    const allocations = historical.length
      ? historical
      : legacy
        ? [{ ...legacy, effectiveFrom: normalizeDateOnly(legacy.createdAt), effectiveTo: null }]
        : [];
    const metrics = computeCycleSummaryForUser({
      year,
      month,
      clients: [{ ...client, lockDay }],
      entries: own,
      allocations,
    }).byClient[0].closedCycle;
    let billableRemaining = client.paysOvertime ? metrics.workedMinutes : metrics.normalMinutes;
    const issues: string[] = [];
    let amount = new Prisma.Decimal(0);
    const rates = new Set<number>();
    if (!allocations.length && own.length) issues.push('MISSING_ALLOCATION');
    for (const entry of own) {
      const minutes = Math.min(closingEligibleMinutes(entry), billableRemaining);
      billableRemaining -= minutes;
      if (!minutes) continue;
      const allocation = [...allocations]
        .reverse()
        .find(
          (row) =>
            row.effectiveFrom <= entry.date && (!row.effectiveTo || row.effectiveTo >= entry.date)
        );
      const rate = allocation?.hourlyRate;
      const unversionedRateChanged =
        historical.length === 0 && legacy && normalizeDateOnly(legacy.updatedAt) > entry.date;
      if (rate == null || unversionedRateChanged) {
        issues.push('MISSING_RATE');
        continue;
      }
      const decimalRate = new Prisma.Decimal(String(rate));
      rates.add(decimalRate.toNumber());
      amount = amount.plus(decimalRate.mul(minutes).div(60));
    }
    lines.push({
      userId: person.id,
      name: person.name,
      workedMinutes: metrics.workedMinutes,
      targetMinutes: metrics.targetMinutes,
      overtimeMinutes: metrics.overtimeMinutes,
      billableMinutes: client.paysOvertime ? metrics.workedMinutes : metrics.normalMinutes,
      hourlyRate: rates.size === 1 ? [...rates][0] : null,
      billableAmount: issues.includes('MISSING_RATE') ? null : amount.toDecimalPlaces(2).toNumber(),
      issues: [...new Set(issues)],
    });
  }
  return {
    clientId,
    clientName: client.name,
    year,
    month,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    policy,
    lines,
    source: {
      lockDay,
      paysOvertime: client.paysOvertime,
      entries: entries.map(({ user: _user, ...entry }) => entry),
      allocationHistory: history.map((allocation) => ({
        userId: allocation.userId,
        allocationType: allocation.allocationType,
        hoursPerDay: allocation.hoursPerDay,
        hoursPerMonth: allocation.hoursPerMonth,
        hourlyRate: allocation.hourlyRate,
        effectiveFrom: allocation.effectiveFrom < start ? start : allocation.effectiveFrom,
        effectiveTo:
          !allocation.effectiveTo || allocation.effectiveTo > end ? end : allocation.effectiveTo,
      })),
      currentAllocations: fallback.map(({ user: _user, ...allocation }) => allocation),
    },
  };
};

export const visibleUserIds = async (tx: Tx, actor: BalanceActor): Promise<number[] | null> =>
  actor.roleId === 1
    ? null
    : [
        actor.userId,
        ...(actor.roleId === 2
          ? await tx.user.findMany({ where: { managerId: actor.userId }, select: { id: true } })
          : []
        ).map((row) => row.id),
      ];

export const closeWorkspace = async (
  actor: BalanceActor,
  clientId: number,
  year: number,
  month: number,
  version?: number
) => {
  const allowed = await visibleUserIds(prisma, actor);
  if (
    allowed &&
    !(await prisma.userClient.findFirst({ where: { clientId, userId: { in: allowed } } })) &&
    !(await prisma.timeEntry.findFirst({ where: { clientId, userId: { in: allowed } } }))
  )
    throw new ForbiddenError();
  const period = await prisma.closingPeriod.findUnique({
    where: { clientId_year_month: { clientId, year, month } },
    include: { revisions: { orderBy: { version: 'desc' } } },
  });
  const latest = period?.revisions[0];
  const policy: ClosePolicy = latest
    ? (JSON.parse(latest.snapshotJson) as CloseSnapshot).policy
    : { clientAccountId: null, consume: 'BILLABLE', individualBank: false };
  const preview = await createPreview(
    prisma,
    clientId,
    year,
    month,
    policy,
    latest ? (JSON.parse(latest.snapshotJson) as CloseSnapshot).source.lockDay : undefined
  );
  const published = period?.revisions.find(
    (revision) => revision.version === (version ?? period.publishedVersion)
  );
  if (version && !published) throw new NotFoundError('CLOSING_REVISION_NOT_FOUND');
  const approved = published ? (JSON.parse(published.snapshotJson) as CloseSnapshot) : null;
  const project = (snapshot: CloseSnapshot) => ({
    ...snapshot,
    source: undefined,
    lines: snapshot.lines.filter((line) => !allowed || allowed.includes(line.userId)),
  });
  return {
    period: period
      ? {
          id: period.id,
          state: period.state,
          version: period.version,
          publishedVersion: period.publishedVersion,
        }
      : { id: null, state: 'DRAFT', version: 0, publishedVersion: 0 },
    preview: project(preview),
    published: approved ? project(approved) : null,
    needsRecalculation: Boolean(published && hash(preview) !== published.contentHash),
    revisions: (period?.revisions ?? []).map(
      ({ snapshotJson: _snapshot, ...revision }) => revision
    ),
  };
};

export const reviseClosing = (
  actor: BalanceActor,
  input: {
    clientId: number;
    year: number;
    month: number;
    expectedVersion: number;
    reason: string;
    policy: ClosePolicy;
    recalculate: boolean;
  }
) =>
  prisma.$transaction(
    async (tx) => {
      if (actor.roleId !== 1) throw new ForbiddenError('ORGANIZATION_SCOPE_REQUIRED');
      await tx.$executeRaw`UPDATE clients SET updatedAt = updatedAt WHERE id = ${input.clientId}`;
      const existing = await tx.closingPeriod.findUnique({
        where: {
          clientId_year_month: {
            clientId: input.clientId,
            year: input.year,
            month: input.month,
          },
        },
      });
      const prior = existing
        ? await tx.closingRevision.findUniqueOrThrow({
            where: {
              periodId_version: { periodId: existing.id, version: existing.version },
            },
          })
        : null;
      const snapshot = await createPreview(
        tx,
        input.clientId,
        input.year,
        input.month,
        input.policy,
        prior ? (JSON.parse(prior.snapshotJson) as CloseSnapshot).source.lockDay : undefined
      );
      if (new Date(snapshot.endDate) >= normalizeDateOnly(new Date()))
        throw new BadRequestError('CLOSING_CYCLE_NOT_ENDED');
      if (snapshot.lines.some((line) => line.issues.length))
        throw new BadRequestError('CLOSING_HAS_PENDING_ISSUES');
      if ((existing?.version ?? 0) !== input.expectedVersion)
        throw new ConflictError('CLOSING_VERSION_CONFLICT');
      if (existing?.publishedVersion && !input.recalculate)
        throw new ConflictError('USE_EXPLICIT_RECALCULATION');
      if (input.recalculate && existing?.publishedVersion) {
        const previous = await tx.closingRevision.findUniqueOrThrow({
          where: {
            periodId_version: {
              periodId: existing.id,
              version: existing.publishedVersion,
            },
          },
        });
        const unlocked = await tx.temporaryUnlock.findFirst({
          where: {
            clientId: input.clientId,
            expiresAt: { gt: previous.approvedAt ?? previous.createdAt },
            OR: [new Date(snapshot.startDate), new Date(snapshot.endDate)].map((date) => ({
              periodYear: date.getUTCFullYear(),
              periodMonth: date.getUTCMonth() + 1,
            })),
          },
        });
        if (!unlocked) throw new ForbiddenError('RECALCULATION_REQUIRES_TEMPORARY_UNLOCK');
      }
      if (existing?.state === 'REVIEW') {
        const previous = await tx.closingRevision.findUniqueOrThrow({
          where: { periodId_version: { periodId: existing.id, version: existing.version } },
        });
        if (previous.contentHash === hash(snapshot))
          return { id: existing.id, version: existing.version, unchanged: true };
      }
      const period =
        existing ??
        (await tx.closingPeriod.create({
          data: {
            clientId: input.clientId,
            year: input.year,
            month: input.month,
            startDate: new Date(snapshot.startDate),
            endDate: new Date(snapshot.endDate),
          },
        }));
      const version = period.version + 1;
      await tx.closingRevision.create({
        data: {
          periodId: period.id,
          version,
          snapshotJson: JSON.stringify(snapshot),
          contentHash: hash(snapshot),
          reason: input.reason,
          createdBy: actor.userId,
        },
      });
      await tx.closingPeriod.update({
        where: { id: period.id },
        data: {
          version,
          state: 'REVIEW',
          startDate: new Date(snapshot.startDate),
          endDate: new Date(snapshot.endDate),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          endpoint: '/api/closing-periods',
          action: input.recalculate ? 'CLOSING_RECALCULATED' : 'CLOSING_SUBMITTED',
          status: 'success',
          details: JSON.stringify({ periodId: period.id, version, reason: input.reason }),
        },
      });
      return { id: period.id, version };
    },
    { timeout: 30000 }
  );

export const approveClosing = (actor: BalanceActor, id: number, expectedVersion: number) =>
  prisma.$transaction(
    async (tx) => {
      if (actor.roleId !== 1) throw new ForbiddenError('ORGANIZATION_SCOPE_REQUIRED');
      const initial = await tx.closingPeriod.findUniqueOrThrow({ where: { id } });
      await tx.$executeRaw`UPDATE clients SET updatedAt = updatedAt WHERE id = ${initial.clientId}`;
      const period = await tx.closingPeriod.findUniqueOrThrow({ where: { id } });
      if (period.version !== expectedVersion) throw new ConflictError('CLOSING_VERSION_CONFLICT');
      if (period.state === 'CLOSED' && period.publishedVersion === expectedVersion) return period;
      if (period.state !== 'REVIEW') throw new ConflictError('CLOSING_NOT_SUBMITTED');
      const revision = await tx.closingRevision.findUniqueOrThrow({
        where: { periodId_version: { periodId: id, version: period.version } },
      });
      const flows = await getFlows(tx);
      if (!flows.closing) throw new ForbiddenError('FLOW_DISABLED');
      if (flows.independentApproval && revision.createdBy === actor.userId)
        throw new ForbiddenError('INDEPENDENT_APPROVER_REQUIRED');
      const snapshot = JSON.parse(revision.snapshotJson) as CloseSnapshot;
      const current = await createPreview(
        tx,
        period.clientId,
        period.year,
        period.month,
        snapshot.policy,
        snapshot.source.lockDay
      );
      if (hash(current) !== revision.contentHash)
        throw new ConflictError('CLOSING_CHANGED_RECALCULATE');
      const previous = period.publishedVersion
        ? await tx.closingRevision.findUniqueOrThrow({
            where: {
              periodId_version: { periodId: id, version: period.publishedVersion },
            },
          })
        : null;
      const previousSnapshot = previous
        ? (JSON.parse(previous.snapshotJson) as CloseSnapshot)
        : null;
      if (
        previousSnapshot &&
        (previousSnapshot.policy.clientAccountId !== snapshot.policy.clientAccountId ||
          previousSnapshot.policy.consume !== snapshot.policy.consume ||
          previousSnapshot.policy.individualBank !== snapshot.policy.individualBank)
      ) {
        throw new ConflictError('PUBLISHED_BALANCE_POLICY_IS_IMMUTABLE');
      }
      const changes: Array<{ accountId: number; delta: number }> = [];
      const consumption = (value: CloseSnapshot) =>
        value.lines.reduce(
          (sum, line) =>
            sum + (value.policy.consume === 'WORKED' ? line.workedMinutes : line.billableMinutes),
          0
        );
      if (snapshot.policy.clientAccountId) {
        if (!flows.clientHourPool) throw new ForbiddenError('FLOW_DISABLED');
        const account = await tx.hourAccount.findUniqueOrThrow({
          where: { id: snapshot.policy.clientAccountId },
        });
        if (account.kind !== 'CLIENT' || account.clientId !== period.clientId)
          throw new BadRequestError('INVALID_CLOSING_ACCOUNT');
        changes.push({
          accountId: account.id,
          delta: (previousSnapshot ? consumption(previousSnapshot) : 0) - consumption(snapshot),
        });
      }
      if (snapshot.policy.individualBank) {
        if (!flows.personalHourBank) throw new ForbiddenError('FLOW_DISABLED');
        const people = new Set(
          [...snapshot.lines, ...(previousSnapshot?.lines ?? [])].map((line) => line.userId)
        );
        for (const userId of people) {
          const account = await tx.hourAccount.findUnique({
            where: { ownerKey: `PERSONAL:${userId}` },
          });
          if (!account) throw new BadRequestError('PERSONAL_HOUR_ACCOUNT_REQUIRED');
          const now = snapshot.lines.find((line) => line.userId === userId);
          const before = previousSnapshot?.lines.find((line) => line.userId === userId);
          changes.push({
            accountId: account.id,
            delta:
              (now ? now.workedMinutes - now.targetMinutes : 0) -
              (before ? before.workedMinutes - before.targetMinutes : 0),
          });
        }
      }
      for (const change of changes.sort((a, b) => a.accountId - b.accountId)) {
        await lockAccount(tx, change.accountId);
        if (change.accountId === snapshot.policy.clientAccountId && change.delta > 0) {
          // Return the consumed lots with their original validity, including expired lots.
          // Expired credits are then explicitly expired again in the same transaction.
          const { rows, state } = await expireCredits(tx, change.accountId);
          let remaining = change.delta;
          const debits = rows
            .filter(
              (row) =>
                row.kind === 'CLOSING' &&
                row.deltaMinutes < 0 &&
                row.sourceKey.startsWith(`closing:${id}:`)
            )
            .reverse();
          for (const debit of debits) {
            let returned = rows
              .filter((row) => row.kind === 'CLOSING_RETURN' && row.parentId === debit.id)
              .reduce((sum, row) => sum + row.deltaMinutes, 0);
            for (const [index, part] of (state.allocations.get(debit.id) ?? []).entries()) {
              const skipped = Math.min(returned, part.minutes);
              returned -= skipped;
              const minutes = Math.min(remaining, part.minutes - skipped);
              if (!minutes) continue;
              await appendMovement(tx, {
                accountId: change.accountId,
                deltaMinutes: minutes,
                kind: 'CLOSING_RETURN',
                sourceKey: `closing:${id}:${period.version}:${change.accountId}:return:${debit.id}:${index}`,
                parentId: debit.id,
                expiresAt: part.expiresAt,
                createdBy: actor.userId,
                reason: `Closing ${period.year}-${period.month}, revision ${period.version}`,
              });
              remaining -= minutes;
            }
          }
          if (remaining) throw new ConflictError('CLOSING_LEDGER_RECONCILIATION_REQUIRED');
          await expireCredits(tx, change.accountId);
          continue;
        }
        if (change.delta)
          await appendMovement(tx, {
            accountId: change.accountId,
            deltaMinutes: change.delta,
            kind: 'CLOSING',
            sourceKey: `closing:${id}:${period.version}:${change.accountId}`,
            reason: `Closing ${period.year}-${period.month}, revision ${period.version}`,
            createdBy: actor.userId,
          });
      }
      await tx.closingRevision.update({
        where: { id: revision.id },
        data: { approvedBy: actor.userId, approvedAt: new Date() },
      });
      const result = await tx.closingPeriod.update({
        where: { id },
        data: { state: 'CLOSED', publishedVersion: period.version },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          endpoint: '/api/closing-periods/approve',
          action: 'CLOSING_APPROVED',
          status: 'success',
          details: JSON.stringify({ periodId: id, version: period.version }),
        },
      });
      return result;
    },
    { timeout: 30000 }
  );

export const returnClosing = (
  actor: BalanceActor,
  id: number,
  expectedVersion: number,
  reason: string
) =>
  prisma.$transaction(async (tx) => {
    if (actor.roleId !== 1) throw new ForbiddenError('ORGANIZATION_SCOPE_REQUIRED');
    const initial = await tx.closingPeriod.findUniqueOrThrow({ where: { id } });
    await tx.$executeRaw`UPDATE clients SET updatedAt = updatedAt WHERE id = ${initial.clientId}`;
    const period = await tx.closingPeriod.findUniqueOrThrow({ where: { id } });
    if (period.version !== expectedVersion || period.state !== 'REVIEW')
      throw new ConflictError('CLOSING_VERSION_CONFLICT');
    await tx.closingPeriod.update({
      where: { id },
      data: { state: period.publishedVersion ? 'CLOSED' : 'DRAFT' },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        endpoint: '/api/closing-periods/return',
        action: 'CLOSING_RETURNED',
        status: 'success',
        details: JSON.stringify({ id, expectedVersion, reason }),
      },
    });
    return { id };
  });
