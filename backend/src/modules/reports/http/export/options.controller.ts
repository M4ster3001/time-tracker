import type { RequestHandler } from 'express';
import { prisma } from '../../../../shared/infrastructure/db/prisma.js';

export const exportOptionsController: RequestHandler = async (req, res, next) => {
  try {
    const actor = req.user!;
    const users = await prisma.user.findMany({ where: { deletedAt: null, isActive: true,
      ...(actor.roleId === 1 ? {} : actor.roleId === 2 ? { OR: [{ id: actor.userId }, { managerId: actor.userId }] } : { id: actor.userId }) },
      select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const clients = await prisma.client.findMany({ where: { deletedAt: null, OR: [
      { userClients: { some: { userId: { in: users.map((user) => user.id) } } } },
      { timeEntries: { some: { userId: { in: users.map((user) => user.id) }, deletedAt: null } } },
    ] }, select: { id: true, name: true, isActive: true }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: { users: actor.roleId === 3 ? [] : users, clients } });
  } catch (error) { next(error); }
};
