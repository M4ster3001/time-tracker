import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import { ConflictError } from '../../../../app/errors/app-error.js';
import type {
  AuthUserRepository,
  AuthUserWithRole,
} from '../../domain/repositories/auth-user.repository.js';

const userWithRoleInclude = {
  role: true,
} satisfies Prisma.UserInclude;

export class PrismaAuthUserRepository implements AuthUserRepository {
  findByEmailWithRole(email: string): Promise<AuthUserWithRole | null> {
    return prisma.user.findUnique({
      where: { email },
      include: userWithRoleInclude,
    });
  }

  findByIdWithRole(userId: number): Promise<AuthUserWithRole | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      include: userWithRoleInclude,
    });
  }

  countUsers(): Promise<number> {
    return prisma.user.count();
  }

  createConsultantUser(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<AuthUserWithRole> {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        roleId: 3,
      },
      include: userWithRoleInclude,
    });
  }

  createAdminUser(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<AuthUserWithRole> {
    return prisma.$transaction(async (tx) => {
      // A unique persistent row serializes initialization on MySQL and SQLite.
      await tx.seedRun.upsert({
        where: { key: 'initial-admin-setup' },
        create: { key: 'initial-admin-setup', lastRunDate: new Date() },
        update: { lastRunDate: new Date() },
      });
      if (await tx.user.count()) throw new ConflictError('Setup already completed');
      for (const [id, name] of [[1, 'Admin'], [2, 'Manager'], [3, 'Consultant']] as const) {
        await tx.role.upsert({ where: { id }, create: { id, name }, update: {} });
      }
      return tx.user.create({ data: { ...data, roleId: 1 }, include: userWithRoleInclude });
    });
  }

  async updateFailedLoginState(params: {
    userId: number;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
  }): Promise<void> {
    await prisma.user.update({
      where: { id: params.userId },
      data: {
        failedLoginAttempts: params.failedLoginAttempts,
        lastFailedLoginAt: new Date(),
        lockedUntil: params.lockedUntil,
      },
    });
  }

  async resetFailedLoginState(userId: number): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
      },
    });
  }

  async unlockUserAccount(userId: number): Promise<void> {
    await this.resetFailedLoginState(userId);
  }
}

export const authUserRepository = new PrismaAuthUserRepository();
