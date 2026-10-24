import type { Express, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { BadRequestError, ForbiddenError, ConflictError } from '../../../app/errors/app-error.js';
import { scopeFor } from '../../access-control/domain/permissions.js';
import {
  approveClosing,
  closeWorkspace,
  reviseClosing,
  returnClosing,
  visibleUserIds,
} from '../application/month-close.service.js';

const positive = z.coerce.number().int().positive();
const query = z.object({
  clientId: positive,
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
const revision = z.object({ expectedVersion: z.number().int().nonnegative() });
const submission = query
  .extend({
    expectedVersion: z.number().int().nonnegative(),
    reason: z.string().trim().min(5).max(2000),
    policy: z
      .object({
        clientAccountId: z.number().int().positive().nullable(),
        consume: z.enum(['WORKED', 'BILLABLE']),
        individualBank: z.boolean(),
      })
      .strict(),
  })
  .strict();
const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestError('INVALID_CLOSING_REQUEST');
  return result.data;
};
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
const ledgerPermission = async (req: Request, periodId?: number) => {
  const period = periodId
    ? await prisma.closingPeriod.findUniqueOrThrow({
        where: { id: periodId },
        include: {
          revisions: { orderBy: { version: 'desc' }, take: 1 },
        },
      })
    : null;
  const policy = period ? JSON.parse(period.revisions[0].snapshotJson).policy : req.body.policy;
  if (
    (policy?.clientAccountId || policy?.individualBank) &&
    scopeFor(req.accessGrants ?? [], 'balances.write') !== 'all'
  ) {
    throw new ForbiddenError('BALANCE_PERMISSION_REQUIRED');
  }
};

export const registerMonthCloseRoutes = (app: Express, auth: RequestHandler[]): void => {
  app.get(
    '/api/closing-periods/options',
    ...auth,
    wrap(async (req, res) => {
      const allowed = await visibleUserIds(prisma, req.user!);
      const clients = await prisma.client.findMany({
        where: {
          deletedAt: null,
          ...(allowed
            ? {
                OR: [
                  { userClients: { some: { userId: { in: allowed } } } },
                  { timeEntries: { some: { userId: { in: allowed }, deletedAt: null } } },
                ],
              }
            : {}),
        },
        select: { id: true, name: true, lockDay: true },
        orderBy: { name: 'asc' },
      });
      // Most recently active clients first, so the page opens on a cycle that has hours.
      const activity = await prisma.timeEntry.groupBy({
        by: ['clientId'],
        where: {
          deletedAt: null,
          clientId: { in: clients.map((client) => client.id) },
          ...(allowed ? { userId: { in: allowed } } : {}),
        },
        _max: { date: true },
      });
      const lastEntry = new Map(activity.map((row) => [row.clientId, row._max.date?.getTime() ?? 0]));
      clients.sort(
        (a, b) =>
          (lastEntry.get(b.id) ?? 0) - (lastEntry.get(a.id) ?? 0) || a.name.localeCompare(b.name)
      );
      const accounts =
        scopeFor(req.accessGrants ?? [], 'balances.write') === 'all'
          ? await prisma.hourAccount.findMany({
              where: { kind: 'CLIENT', isActive: true },
              select: { id: true, clientId: true, name: true },
              orderBy: { name: 'asc' },
            })
          : [];
      res.json({ success: true, data: { clients, accounts } });
    })
  );
  app.get(
    '/api/closing-periods',
    ...auth,
    wrap(async (req, res) => {
      const input = parse(query, req.query);
      res.json({
        success: true,
        data: await closeWorkspace(req.user!, input.clientId, input.year, input.month),
      });
    })
  );
  for (const action of ['submit', 'recalculate'] as const)
    app.post(
      `/api/closing-periods/${action}`,
      ...auth,
      wrap(async (req, res) => {
        const input = parse(submission, req.body);
        await ledgerPermission(req);
        res.json({
          success: true,
          data: await reviseClosing(req.user!, { ...input, recalculate: action === 'recalculate' }),
        });
      })
    );
  app.post(
    '/api/closing-periods/:id/approve',
    ...auth,
    wrap(async (req, res) => {
      const id = parse(positive, req.params.id),
        input = parse(revision, req.body);
      await ledgerPermission(req, id);
      res.json({ success: true, data: await approveClosing(req.user!, id, input.expectedVersion) });
    })
  );
  app.post(
    '/api/closing-periods/:id/return',
    ...auth,
    wrap(async (req, res) => {
      const input = parse(
        revision.extend({ reason: z.string().trim().min(5).max(2000) }),
        req.body
      );
      res.json({
        success: true,
        data: await returnClosing(
          req.user!,
          parse(positive, req.params.id),
          input.expectedVersion,
          input.reason
        ),
      });
    })
  );
  app.get(
    '/api/closing-periods/export',
    ...auth,
    wrap(async (req, res) => {
      if (
        scopeFor(req.accessGrants ?? [], 'reports.export') !== 'all' ||
        scopeFor(req.accessGrants ?? [], 'rates.read') !== 'all'
      )
        throw new ForbiddenError();
      const input = parse(
        query.extend({
          version: positive.optional(),
          locale: z.enum(['pt-BR', 'en']).default('pt-BR'),
        }),
        req.query
      );
      const workspace = await closeWorkspace(
        req.user!,
        input.clientId,
        input.year,
        input.month,
        input.version
      );
      const snapshot = workspace.published;
      const published = workspace.revisions.find(
        (item) => item.version === (input.version ?? workspace.period.publishedVersion)
      );
      if (!snapshot || !published?.approvedAt) throw new ConflictError('APPROVED_CLOSING_REQUIRED');
      const english = input.locale === 'en';
      const book = new ExcelJS.Workbook();
      book.creator = 'Time Tracker';
      const sheet = book.addWorksheet(english ? 'Approved close' : 'Fechamento aprovado');
      sheet.addRow([
        snapshot.clientName,
        `${input.year}-${String(input.month).padStart(2, '0')}`,
        `v${published.version}`,
      ]);
      sheet.addRow([
        snapshot.startDate.slice(0, 10),
        snapshot.endDate.slice(0, 10),
        published.contentHash,
      ]);
      sheet.addRow(
        english
          ? [
              'Person',
              'Worked minutes',
              'Target minutes',
              'Overtime minutes',
              'Billable minutes',
              'Amount BRL',
            ]
          : [
              'Pessoa',
              'Minutos trabalhados',
              'Meta em minutos',
              'Minutos extras',
              'Minutos faturáveis',
              'Valor BRL',
            ]
      );
      for (const line of snapshot.lines)
        sheet.addRow([
          line.name,
          line.workedMinutes,
          line.targetMinutes,
          line.overtimeMinutes,
          line.billableMinutes,
          line.billableAmount,
        ]);
      sheet.columns.forEach((column) => {
        column.width = 25;
      });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="closing-${input.clientId}-${input.year}-${input.month}-v${published.version}.xlsx"`
      );
      await book.xlsx.write(res);
      res.end();
    })
  );
};
