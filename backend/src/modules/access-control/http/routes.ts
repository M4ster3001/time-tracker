import type { Express, RequestHandler, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { config } from '../../../config.js';
import { BadRequestError, ForbiddenError } from '../../../app/errors/app-error.js';
import {
  assignGroups,
  flowKeys,
  getFlows,
  getUserGrants,
  saveGroup,
} from '../application/access-control.service.js';
import { permissionKeys, scopeFor } from '../domain/permissions.js';
import { navigationFor } from '../domain/navigation.js';

const grantSchema = z.object({
  permission: z.enum(permissionKeys),
  scope: z.enum(['self', 'team', 'all']),
});
const groupSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(190).default(''),
  isActive: z.boolean().default(true),
  grants: z.array(grantSchema).max(100),
});
const handler =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestError('Invalid access-control request');
  return result.data;
};
const manager: RequestHandler = (req, _res, next) =>
  next(
    scopeFor(req.accessGrants ?? [], 'access.manage') === 'all' ? undefined : new ForbiddenError()
  );

export const registerAccessControlRoutes = (app: Express, auth: RequestHandler[]): void => {
  app.get(
    '/api/capabilities',
    ...auth,
    handler(async (req, res) => {
      const grants = req.accessGrants ?? (await getUserGrants(req.user!.userId));
      const flows = await getFlows();
      const preferences = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { locale: true, accessMode: true },
      });
      res.json({
        success: true,
        data: {
          grants,
          flows,
          locale: preferences?.locale ?? 'pt-BR',
          accessMode: preferences?.accessMode,
          navigation: navigationFor(grants, flows, config.desktopMode, {
            roleId: req.authenticatedRoleId ?? req.user!.roleId,
          }),
        },
      });
    })
  );
  app.put(
    '/api/preferences',
    ...auth,
    handler(async (req, res) => {
      const data = parse(z.object({ locale: z.enum(['pt-BR', 'en']) }), req.body);
      await prisma.user.update({ where: { id: req.user!.userId }, data });
      res.json({ success: true, data });
    })
  );
  app.get(
    '/api/access-control',
    ...auth,
    manager,
    handler(async (_req, res) => {
      const [groups, users, flows] = await Promise.all([
        prisma.accessGroup.findMany({ include: { grants: true }, orderBy: { name: 'asc' } }),
        prisma.user.findMany({
          where: { deletedAt: null },
          take: 500,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            email: true,
            roleId: true,
            accessMode: true,
            accessMemberships: { select: { groupId: true } },
          },
        }),
        getFlows(),
      ]);
      res.json({ success: true, data: { groups, users, flows, permissions: permissionKeys } });
    })
  );
  app.post(
    '/api/access-control/groups',
    ...auth,
    manager,
    handler(async (req, res) => {
      res.json({
        success: true,
        data: await saveGroup(req.user!.userId, parse(groupSchema, req.body)),
      });
    })
  );
  app.put(
    '/api/access-control/memberships',
    ...auth,
    manager,
    handler(async (req, res) => {
      const data = parse(
        z.object({
          userId: z.number().int().positive(),
          groupIds: z.array(z.number().int().positive()).max(50),
        }),
        req.body
      );
      res.json({
        success: true,
        data: await assignGroups(req.user!.userId, data.userId, data.groupIds),
      });
    })
  );
  app.put(
    '/api/access-control/flows',
    ...auth,
    manager,
    handler(async (req, res) => {
      const data = parse(
        z.array(z.object({ key: z.enum(flowKeys), enabled: z.boolean() })).max(flowKeys.length),
        req.body
      );
      await prisma.$transaction(async (tx) => {
        for (const setting of data)
          await tx.featureSetting.upsert({
            where: { key: setting.key },
            create: { ...setting, updatedBy: req.user!.userId },
            update: { ...setting, updatedBy: req.user!.userId },
          });
        await tx.auditLog.create({
          data: {
            userId: req.user!.userId,
            endpoint: '/api/access-control/flows',
            action: 'FLOWS_CHANGED',
            status: 'success',
            details: JSON.stringify(data),
          },
        });
      });
      res.json({ success: true, data: await getFlows() });
    })
  );
};
