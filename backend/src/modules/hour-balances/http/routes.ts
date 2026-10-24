import type { Express, Request, RequestHandler, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { BadRequestError, ForbiddenError, ConflictError } from '../../../app/errors/app-error.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import {
  accountDetail,
  appendMovement,
  canUseAccount,
  expireCredits,
  lockAccount,
  reverseMovement,
  type BalanceActor,
} from '../application/hour-balance.service.js';
import { replayLedger } from '../domain/hour-ledger.js';

const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestError('INVALID_BALANCE_REQUEST');
  return result.data;
};
const idSchema = z.coerce.number().int().positive();
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
const actor = (req: Request): BalanceActor => req.user!;
const checkFlow = async (
  kind: string,
  tx: Pick<Prisma.TransactionClient, 'featureSetting'> = prisma
) => {
  const flows = await getFlows(tx);
  if (!(kind === 'CLIENT' ? flows.clientHourPool : flows.personalHourBank))
    throw new ForbiddenError('FLOW_DISABLED');
};

export const registerHourBalanceRoutes = (app: Express, auth: RequestHandler[]): void => {
  app.get(
    '/api/hour-accounts/options',
    ...auth,
    wrap(async (req, res) => {
      const who = actor(req);
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          ...(who.roleId === 1
            ? {}
            : who.roleId === 2
              ? { OR: [{ id: who.userId }, { managerId: who.userId }] }
              : { id: who.userId }),
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      const clients =
        who.roleId === 3
          ? []
          : await prisma.client.findMany({
              where: {
                isActive: true,
                deletedAt: null,
                ...(who.roleId === 1
                  ? {}
                  : { userClients: { some: { userId: { in: users.map((user) => user.id) } } } }),
              },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            });
      res.json({ success: true, data: { users, clients } });
    })
  );
  app.get(
    '/api/hour-accounts',
    ...auth,
    wrap(async (req, res) => {
      const cursor = req.query.cursor ? parse(idSchema, req.query.cursor) : 0;
      const who = actor(req);
      const users =
        who.roleId === 2
          ? await prisma.user.findMany({ where: { managerId: who.userId }, select: { id: true } })
          : [];
      const clients =
        who.roleId === 2
          ? await prisma.userClient.findMany({
              where: { userId: { in: [who.userId, ...users.map((user) => user.id)] } },
              select: { clientId: true },
            })
          : [];
      const accounts = await prisma.hourAccount.findMany({
        where: {
          id: { gt: cursor },
          ...(who.roleId === 1
            ? {}
            : {
                OR: [
                  { userId: { in: [who.userId, ...users.map((user) => user.id)] } },
                  ...(who.roleId === 2
                    ? [{ clientId: { in: clients.map((client) => client.clientId) } }]
                    : []),
                ],
              }),
        },
        take: 51,
        orderBy: { id: 'asc' },
      });
      const items = await Promise.all(
        accounts.slice(0, 50).map(async (account) => {
          const detail = await accountDetail(who, account.id);
          const { movements: _movements, ...summary } = detail;
          return summary;
        })
      );
      res.json({
        success: true,
        data: { items, nextCursor: accounts.length > 50 ? accounts[49].id : null },
      });
    })
  );
  app.get(
    '/api/hour-accounts/:id',
    ...auth,
    wrap(async (req, res) => {
      res.json({
        success: true,
        data: await accountDetail(actor(req), parse(idSchema, req.params.id)),
      });
    })
  );
  app.post(
    '/api/hour-accounts',
    ...auth,
    wrap(async (req, res) => {
      const input = parse(
        z
          .object({
            kind: z.enum(['CLIENT', 'PERSONAL']),
            ownerId: idSchema,
            name: z.string().trim().min(1).max(120),
            reference: z
              .string()
              .regex(/^[A-Za-z0-9_-]{1,50}$/)
              .default('default'),
            allowNegative: z.boolean().default(false),
          })
          .strict(),
        req.body
      );
      await checkFlow(input.kind);
      const data = {
        kind: input.kind,
        name: input.name,
        allowNegative: input.allowNegative,
        ownerKey:
          input.kind === 'CLIENT'
            ? `CLIENT:${input.ownerId}:${input.reference}`
            : `PERSONAL:${input.ownerId}`,
        clientId: input.kind === 'CLIENT' ? input.ownerId : null,
        userId: input.kind === 'PERSONAL' ? input.ownerId : null,
      };
      if (!(await canUseAccount(prisma, actor(req), data as never))) throw new ForbiddenError();
      res.status(201).json({ success: true, data: await prisma.hourAccount.create({ data }) });
    })
  );
  app.post(
    '/api/hour-accounts/:id/movements',
    ...auth,
    wrap(async (req, res) => {
      const input = parse(
        z
          .object({
            deltaMinutes: z
              .number()
              .int()
              .min(-5256000)
              .max(5256000)
              .refine((n) => n !== 0),
            reason: z.string().trim().min(5).max(2000),
            requestKey: z.string().uuid(),
            expiresAt: z.string().datetime().nullable().optional(),
          })
          .strict(),
        req.body
      );
      if (input.expiresAt && (input.deltaMinutes < 0 || new Date(input.expiresAt) <= new Date()))
        throw new BadRequestError('INVALID_CREDIT_EXPIRY');
      const result = await prisma.$transaction(async (tx) => {
        const account = await lockAccount(tx, parse(idSchema, req.params.id));
        if (!(await canUseAccount(tx, actor(req), account))) throw new ForbiddenError();
        await checkFlow(account.kind, tx);
        return appendMovement(tx, {
          accountId: account.id,
          deltaMinutes: input.deltaMinutes,
          kind: input.deltaMinutes > 0 ? 'CREDIT' : 'DEBIT',
          reason: input.reason,
          sourceKey: `manual:${input.requestKey}`,
          createdBy: req.user!.userId,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        });
      });
      res.status(201).json({ success: true, data: result });
    })
  );
  app.post(
    '/api/hour-accounts/:id/reverse',
    ...auth,
    wrap(async (req, res) => {
      const input = parse(
        z.object({
          movementId: idSchema,
          requestKey: z.string().uuid(),
          reason: z.string().trim().min(5).max(2000),
        }),
        req.body
      );
      const result = await prisma.$transaction(async (tx) => {
        const account = await lockAccount(tx, parse(idSchema, req.params.id));
        await checkFlow(account.kind, tx);
        return reverseMovement(tx, actor(req), { ...input, accountId: account.id });
      });
      res.json({ success: true, data: result });
    })
  );
  app.post(
    '/api/hour-accounts/:id/transfer',
    ...auth,
    wrap(async (req, res) => {
      const input = parse(
        z.object({
          destinationId: idSchema,
          minutes: z.number().int().positive().max(5256000),
          requestKey: z.string().uuid(),
          reason: z.string().trim().min(5).max(2000),
        }),
        req.body
      );
      const sourceId = parse(idSchema, req.params.id);
      if (sourceId === input.destinationId)
        throw new BadRequestError('TRANSFER_REQUIRES_TWO_ACCOUNTS');
      const result = await prisma.$transaction(async (tx) => {
        for (const id of [sourceId, input.destinationId].sort((a, b) => a - b))
          await lockAccount(tx, id);
        const source = await lockAccount(tx, sourceId),
          destination = await lockAccount(tx, input.destinationId);
        if (
          !(await canUseAccount(tx, actor(req), source)) ||
          !(await canUseAccount(tx, actor(req), destination))
        )
          throw new ForbiddenError();
        if (
          source.kind !== 'CLIENT' ||
          destination.kind !== 'CLIENT' ||
          source.clientId !== destination.clientId
        ) {
          throw new BadRequestError('TRANSFER_REQUIRES_SAME_CLIENT');
        }
        await checkFlow('CLIENT', tx);
        const existing = await tx.hourMovement.findUnique({
          where: { sourceKey: `transfer:${input.requestKey}` },
        });
        if (existing) {
          if (
            existing.accountId !== sourceId ||
            existing.deltaMinutes !== -input.minutes ||
            existing.relatedAccountId !== input.destinationId ||
            existing.reason !== input.reason
          )
            throw new ConflictError('IDEMPOTENCY_KEY_REUSED');
          return existing;
        }
        const out = await appendMovement(tx, {
          accountId: sourceId,
          deltaMinutes: -input.minutes,
          kind: 'CONTRACT_TRANSFER',
          sourceKey: `transfer:${input.requestKey}`,
          reason: input.reason,
          relatedAccountId: destination.id,
          createdBy: req.user!.userId,
        });
        const { rows } = await expireCredits(tx, sourceId);
        const allocation = replayLedger(rows).allocations.get(out.id) ?? [];
        for (const [index, part] of allocation.entries())
          await appendMovement(tx, {
            accountId: destination.id,
            deltaMinutes: part.minutes,
            kind: 'CONTRACT_TRANSFER',
            sourceKey: `transfer:${input.requestKey}:${index}`,
            parentId: out.id,
            relatedAccountId: sourceId,
            reason: input.reason,
            createdBy: req.user!.userId,
            expiresAt: part.expiresAt,
          });
        return out;
      });
      res.json({ success: true, data: result });
    })
  );
};
