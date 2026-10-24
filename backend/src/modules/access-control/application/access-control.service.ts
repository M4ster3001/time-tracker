import type { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { config } from '../../../config.js';
import { ForbiddenError } from '../../../app/errors/app-error.js';
import { isGrant, legacyGrants, scopeFor, type Grant } from '../domain/permissions.js';

export const flowKeys = [
  'calendar',
  'ai',
  'tokens',
  'sync',
  'clientHourPool',
  'personalHourBank',
  'closing',
  'independentApproval',
  'publicRegistration',
  'projects',
  'estimates',
  // TRK-01 / MCP-01: off-by-default ate configuracao explicita.
  'tracking',
  'mcp',
] as const;
export type Flow = (typeof flowKeys)[number];

export const getFlows = async (
  db: Pick<Prisma.TransactionClient, 'featureSetting'> = prisma
): Promise<Record<Flow, boolean>> => {
  const defaults: Record<Flow, boolean> = {
    calendar: config.google.enabled,
    ai: config.ai.enabled,
    tokens: true,
    sync: true,
    clientHourPool: true,
    personalHourBank: true,
    closing: true,
    independentApproval: false,
    publicRegistration: config.auth.allowRegistration,
    // PRJ-01 / EST: habilitados por padrao; podem desligar em FeatureSetting / Acessos.
    projects: true,
    estimates: true,
    tracking: false,
    mcp: false,
  };
  for (const setting of await db.featureSetting.findMany()) {
    if (flowKeys.includes(setting.key as Flow)) defaults[setting.key as Flow] = setting.enabled;
  }
  defaults.ai &&= config.ai.enabled;
  defaults.calendar &&= config.google.enabled;
  defaults.publicRegistration &&= !config.desktopMode;
  return defaults;
};

type AccessUser = {
  roleId: number;
  accessMode: string;
  accessMemberships: Array<{
    group: { isActive: boolean; grants: Array<{ permission: string; scope: string }> };
  }>;
};

export const grantsForUser = (user: AccessUser): Grant[] =>
  user.accessMode === 'LEGACY'
    ? legacyGrants(user.roleId)
    : user.accessMemberships.flatMap(({ group }) =>
        group.isActive ? group.grants.filter(isGrant) : []
      );

export const getUserGrants = async (userId: number): Promise<Grant[]> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accessMemberships: { include: { group: { include: { grants: true } } } },
    },
  });
  if (!user || !user.isActive || user.deletedAt) return [];
  return grantsForUser(user);
};

// Include inactive/deleted assignments when protecting privileged accounts from
// password replacement followed by reactivation or restoration.
export const getAssignedUserGrants = async (userId: number): Promise<Grant[]> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accessMemberships: { include: { group: { include: { grants: true } } } },
    },
  });
  return user ? grantsForUser(user) : [];
};

export const withAccessSafety = <T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> =>
  prisma.$transaction(async (tx) => {
    await tx.seedRun.upsert({
      where: { key: 'access-control-lock' },
      create: { key: 'access-control-lock', lastRunDate: new Date() },
      update: { lastRunDate: new Date() },
    });
    const result = await operation(tx);
    const users = await tx.user.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        accessMemberships: { include: { group: { include: { grants: true } } } },
      },
    });
    if (!users.some((user) => scopeFor(grantsForUser(user), 'access.manage') === 'all')) {
      throw new ForbiddenError('LAST_ACCESS_MANAGER');
    }
    return result;
  });

export const saveGroup = (
  actorId: number,
  data: {
    id?: number;
    name: string;
    description: string;
    isActive: boolean;
    grants: Grant[];
  }
) =>
  withAccessSafety(async (tx) => {
    const { grants, id, ...fields } = data;
    const group = id
      ? await tx.accessGroup.update({ where: { id }, data: fields })
      : await tx.accessGroup.create({ data: fields });
    await tx.accessGrant.deleteMany({ where: { groupId: group.id } });
    for (const grant of new Map(
      grants.map((grant) => [`${grant.permission}:${grant.scope}`, grant])
    ).values()) {
      await tx.accessGrant.create({ data: { ...grant, groupId: group.id } });
    }
    await tx.auditLog.create({
      data: {
        userId: actorId,
        endpoint: '/api/access-control/groups',
        action: 'ACCESS_GROUP_SAVED',
        status: 'success',
        details: JSON.stringify({ groupId: group.id, ...data }),
      },
    });
    return group;
  });

export const assignGroups = (actorId: number, userId: number, groupIds: number[]) =>
  withAccessSafety(async (tx) => {
    await tx.accessMembership.deleteMany({ where: { userId } });
    for (const groupId of new Set(groupIds)) {
      await tx.accessMembership.create({ data: { userId, groupId } });
    }
    // Empty custom membership means no permissions, never a fallback to Admin.
    await tx.user.update({ where: { id: userId }, data: { accessMode: 'CUSTOM' } });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        endpoint: '/api/access-control/memberships',
        action: 'ACCESS_MEMBERSHIPS_CHANGED',
        status: 'success',
        details: JSON.stringify({ userId, groupIds }),
      },
    });
    return { userId, groupIds };
  });
