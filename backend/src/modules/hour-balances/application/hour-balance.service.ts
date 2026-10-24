import type { Prisma, HourAccount } from '@prisma/client';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../app/errors/app-error.js';
import { replayLedger } from '../domain/hour-ledger.js';

export type BalanceActor = { userId: number; roleId: number };
type Tx = Prisma.TransactionClient;

export const canUseAccount = async (
  tx: Tx,
  actor: BalanceActor,
  account: HourAccount
): Promise<boolean> => {
  if (actor.roleId === 1) return true;
  if (account.userId === actor.userId) return true;
  if (actor.roleId !== 2) return false;
  if (account.userId)
    return Boolean(
      await tx.user.findFirst({ where: { id: account.userId, managerId: actor.userId } })
    );
  return Boolean(
    await tx.userClient.findFirst({
      where: {
        clientId: account.clientId!,
        OR: [{ userId: actor.userId }, { user: { managerId: actor.userId } }],
      },
    })
  );
};

export const lockAccount = async (tx: Tx, id: number): Promise<HourAccount> => {
  await tx.$executeRaw`UPDATE hour_accounts SET isActive = isActive WHERE id = ${id}`;
  const account = await tx.hourAccount.findUnique({ where: { id } });
  if (!account) throw new NotFoundError('HOUR_ACCOUNT_NOT_FOUND');
  return account;
};

export const expireCredits = async (tx: Tx, accountId: number, now = new Date()) => {
  const rows = await tx.hourMovement.findMany({
    where: { accountId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const state = replayLedger(rows);
  for (const lot of state.lots.values()) {
    if (lot.remaining > 0 && lot.expiresAt && lot.expiresAt <= now) {
      const movement = await tx.hourMovement.create({
        data: {
          accountId,
          deltaMinutes: -lot.remaining,
          kind: 'EXPIRATION',
          sourceKey: `expiry:${lot.id}`,
          reason: 'Credit validity ended',
          createdBy: 0,
          expiresCreditId: lot.id,
        },
      });
      rows.push(movement);
    }
  }
  return { rows, state: replayLedger(rows) };
};

export const appendMovement = async (
  tx: Tx,
  input: {
    accountId: number;
    deltaMinutes: number;
    kind: string;
    sourceKey: string;
    reason: string;
    createdBy: number;
    expiresAt?: Date | null;
    parentId?: number;
    expiresCreditId?: number;
    relatedAccountId?: number;
  }
) => {
  const account = await lockAccount(tx, input.accountId);
  if (!account.isActive) throw new ForbiddenError('HOUR_ACCOUNT_INACTIVE');
  const existing = await tx.hourMovement.findUnique({ where: { sourceKey: input.sourceKey } });
  if (existing) {
    if (
      existing.accountId !== input.accountId ||
      existing.deltaMinutes !== input.deltaMinutes ||
      existing.kind !== input.kind ||
      existing.reason !== input.reason ||
      (existing.relatedAccountId ?? null) !== (input.relatedAccountId ?? null) ||
      (existing.expiresAt?.getTime() ?? null) !== (input.expiresAt?.getTime() ?? null)
    ) {
      throw new ConflictError('IDEMPOTENCY_KEY_REUSED');
    }
    return existing;
  }
  if (!Number.isSafeInteger(input.deltaMinutes) || input.deltaMinutes === 0)
    throw new BadRequestError('INVALID_HOUR_MOVEMENT');
  const { state } = await expireCredits(tx, account.id);
  if (!account.allowNegative && state.balance + input.deltaMinutes < 0)
    throw new ConflictError('INSUFFICIENT_HOUR_BALANCE');
  return tx.hourMovement.create({ data: { ...input, expiresAt: input.expiresAt ?? null } });
};

export const reverseMovement = async (
  tx: Tx,
  actor: BalanceActor,
  input: {
    accountId: number;
    movementId: number;
    requestKey: string;
    reason: string;
  }
) => {
  const account = await lockAccount(tx, input.accountId);
  if (!(await canUseAccount(tx, actor, account))) throw new ForbiddenError();
  const original = await tx.hourMovement.findFirst({
    where: { id: input.movementId, accountId: account.id },
  });
  if (
    !original ||
    !['CREDIT', 'DEBIT', 'ADJUSTMENT'].includes(original.kind) ||
    original.parentId
  ) {
    throw new BadRequestError('MOVEMENT_CANNOT_BE_REVERSED');
  }
  const duplicate = await tx.hourMovement.findUnique({ where: { reversesId: original.id } });
  if (duplicate) {
    if (duplicate.sourceKey !== `reverse:${input.requestKey}`)
      throw new ConflictError('MOVEMENT_ALREADY_REVERSED');
    return duplicate;
  }
  const { state } = await expireCredits(tx, account.id);
  if (
    original.deltaMinutes > 0 &&
    state.lots.get(original.id)?.remaining !== original.deltaMinutes
  ) {
    throw new ConflictError('CONSUMED_CREDIT_REQUIRES_ADJUSTMENT');
  }
  const parent = await tx.hourMovement.create({
    data: {
      accountId: account.id,
      deltaMinutes: 0,
      kind: 'REVERSAL',
      sourceKey: `reverse:${input.requestKey}`,
      reason: input.reason,
      createdBy: actor.userId,
      reversesId: original.id,
    },
  });
  const parts =
    original.deltaMinutes < 0
      ? (state.allocations.get(original.id) ?? [])
      : [{ minutes: -original.deltaMinutes, expiresAt: original.expiresAt }];
  for (const [index, part] of parts.entries()) {
    await appendMovement(tx, {
      accountId: account.id,
      deltaMinutes: part.minutes,
      kind: 'REVERSAL_PART',
      sourceKey: `reverse:${input.requestKey}:${index}`,
      reason: input.reason,
      createdBy: actor.userId,
      parentId: parent.id,
      expiresAt: part.minutes > 0 ? part.expiresAt : null,
      ...(part.minutes < 0 ? { expiresCreditId: original.id } : {}),
    });
  }
  await expireCredits(tx, account.id);
  return parent;
};

export const accountDetail = (actor: BalanceActor, id: number) =>
  prisma.$transaction(async (tx) => {
    const account = await lockAccount(tx, id);
    if (!(await canUseAccount(tx, actor, account))) throw new ForbiddenError();
    const { rows, state } = await expireCredits(tx, id);
    return {
      ...account,
      balanceMinutes: state.balance,
      nextExpiry:
        [...state.lots.values()]
          .filter((lot) => lot.remaining > 0 && lot.expiresAt)
          .sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime())[0]?.expiresAt ?? null,
      movements: rows.slice(-200).reverse(),
      movementCount: rows.length,
    };
  });
