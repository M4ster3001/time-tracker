import type { PrismaClient } from '@prisma/client';
import { withAccessSafety } from '../../../access-control/application/access-control.service.js';
import type {
  AdminBulkRepository,
  AdminBulkUserRecord,
} from '../../domain/repositories/admin-bulk.repository.js';

export class PrismaAdminBulkRepository implements AdminBulkRepository {
  constructor(private readonly db: Pick<PrismaClient, 'user' | 'auditLog'>) {}

  async listUserEmails(): Promise<string[]> {
    const users = await this.db.user.findMany({ select: { email: true } });
    return users.map((user) => user.email.toLowerCase());
  }

  findManagerById(managerId: number): Promise<{ id: number } | null> {
    return this.db.user.findFirst({
      where: { id: managerId, roleId: 2, deletedAt: null },
      select: { id: true },
    });
  }

  createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    roleId: number;
    managerId: number | null;
  }): Promise<{ id: number; name: string; email: string }> {
    return this.db.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        roleId: data.roleId,
        managerId: data.managerId,
        isActive: true,
      },
      select: { id: true, name: true, email: true },
    });
  }

  findUserById(userId: number): Promise<AdminBulkUserRecord | null> {
    return this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, roleId: true, deletedAt: true },
    });
  }

  async updateUserActive(userId: number, isActive: boolean): Promise<void> {
    if (!isActive) {
      await withAccessSafety((tx) => tx.user.update({ where: { id: userId }, data: { isActive } }));
      return;
    }
    await this.db.user.update({ where: { id: userId }, data: { isActive } });
  }

  async logAudit(data: {
    userId: number;
    endpoint: string;
    action: string;
    status: string;
    details: string;
  }): Promise<void> {
    await this.db.auditLog.create({ data });
  }
}
