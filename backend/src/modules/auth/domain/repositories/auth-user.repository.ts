import type { Prisma } from '@prisma/client';

export type AuthUserWithRole = Prisma.UserGetPayload<{
  include: { role: true };
}>;

export interface AuthUserRepository {
  findByEmailWithRole(email: string): Promise<AuthUserWithRole | null>;
  findByIdWithRole(userId: number): Promise<AuthUserWithRole | null>;
  countUsers(): Promise<number>;
  createConsultantUser(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<AuthUserWithRole>;
  createAdminUser(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<AuthUserWithRole>;
  updateFailedLoginState(params: {
    userId: number;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
  }): Promise<void>;
  resetFailedLoginState(userId: number): Promise<void>;
  unlockUserAccount(userId: number): Promise<void>;
}
