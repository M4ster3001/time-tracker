import { hashPassword, comparePassword } from '../../../shared/infrastructure/crypto/password.js';
import { generateToken } from '../../../shared/infrastructure/crypto/jwt.js';
import { validateAndNormalizeEmail } from '../../../shared/domain/validation/email.js';
import {
  ConflictError,
  UnauthorizedError,
  BadRequestError,
} from '../../../app/errors/app-error.js';
import type { IAuthResponse, ILoginRequest, IRegisterRequest } from '../domain/auth.types.js';
import type { IUserWithRole } from '../../users/domain/user.types.js';
import { authUserRepository } from '../infrastructure/repositories/prisma-auth-user.repository.js';
import type { AuthServiceDeps } from './auth.service.interfaces.js';
import type { PasswordValidationResult } from './auth.service.types.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';

export const validatePasswordStrength = (password: string): PasswordValidationResult => {
  const errors: string[] = [];

  if (password.length < 12) errors.push('Password must be at least 12 characters');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { isValid: errors.length === 0, errors };
};

const defaultDeps: AuthServiceDeps = {
  users: authUserRepository,
};

/**
 * Remove o hash da senha e o estado interno de bloqueio antes de devolver o
 * usuario ao cliente. Sem isso o bcrypt hash vaza no corpo da resposta.
 */
const toPublicUser = (user: { passwordHash?: string } & Record<string, unknown>): IUserWithRole => {
  const {
    passwordHash: _passwordHash,
    failedLoginAttempts: _failedLoginAttempts,
    lastFailedLoginAt: _lastFailedLoginAt,
    lockedUntil: _lockedUntil,
    ...publicUser
  } = user;

  return publicUser as unknown as IUserWithRole;
};

export const register = async (
  data: IRegisterRequest,
  deps: AuthServiceDeps = defaultDeps
): Promise<IAuthResponse> => {
  const normalizedEmail = validateAndNormalizeEmail(data.email);
  const existingUser = await deps.users.findByEmailWithRole(normalizedEmail);
  if (existingUser) throw new ConflictError('User already exists');

  const passwordValidation = validatePasswordStrength(data.password);
  if (!passwordValidation.isValid) {
    throw new BadRequestError(passwordValidation.errors.join('. '));
  }

  const passwordHash = await hashPassword(data.password);
  const user = await deps.users.createConsultantUser({
    name: data.name,
    email: normalizedEmail,
    passwordHash,
  });

  return {
    token: generateToken({
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
    }),
    user: toPublicUser(user),
  };
};

/**
 * Primeiro boot: o app so precisa de setup enquanto nao existir nenhum usuario.
 */
export const getSetupStatus = async (
  deps: AuthServiceDeps = defaultDeps
): Promise<{ needsSetup: boolean }> => {
  const total = await deps.users.countUsers();
  return { needsSetup: total === 0 };
};

/**
 * Cria o primeiro administrador. So e permitido enquanto o banco nao tiver
 * nenhum usuario -- caso contrario seria um backdoor de escalacao de privilegio.
 */
export const setupInitialAdmin = async (
  data: IRegisterRequest,
  deps: AuthServiceDeps = defaultDeps
): Promise<IAuthResponse> => {
  const total = await deps.users.countUsers();
  if (total > 0) {
    throw new ConflictError('Setup already completed');
  }

  const normalizedEmail = validateAndNormalizeEmail(data.email);

  const passwordValidation = validatePasswordStrength(data.password);
  if (!passwordValidation.isValid) {
    throw new BadRequestError(passwordValidation.errors.join('. '));
  }

  const passwordHash = await hashPassword(data.password);
  const user = await deps.users.createAdminUser({
    name: data.name,
    email: normalizedEmail,
    passwordHash,
  });

  return {
    token: generateToken({
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
    }),
    user: toPublicUser(user),
  };
};

export const login = async (
  data: ILoginRequest,
  deps: AuthServiceDeps = defaultDeps
): Promise<IAuthResponse> => {
  const user = await deps.users.findByEmailWithRole(data.email);

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await comparePassword(data.password, DUMMY_HASH);
    const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new UnauthorizedError(`Account locked. Try again in ${remainingMinutes} minutes.`);
  }

  const isPasswordValid = await comparePassword(data.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user) throw new UnauthorizedError('Invalid credentials');
  if (user.isActive === false) throw new UnauthorizedError('User is inactive');

  if (!isPasswordValid) {
    const newAttempts = user.failedLoginAttempts + 1;
    const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

    await deps.users.updateFailedLoginState({
      userId: user.id,
      failedLoginAttempts: newAttempts,
      lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000) : null,
    });

    if (shouldLock) {
      throw new UnauthorizedError(
        `Account locked due to too many failed attempts. Try again in ${LOCKOUT_DURATION_MINUTES} minutes.`
      );
    }

    throw new UnauthorizedError('Invalid credentials');
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await deps.users.resetFailedLoginState(user.id);
  }

  return {
    token: generateToken({
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
    }),
    user: toPublicUser(user),
  };
};

export const getUserById = async (
  userId: number,
  deps: AuthServiceDeps = defaultDeps
): Promise<IUserWithRole | null> => {
  const found = await deps.users.findByIdWithRole(userId);
  return found ? toPublicUser(found) : null;
};

export const unlockUserAccount = async (
  userId: number,
  deps: AuthServiceDeps = defaultDeps
): Promise<void> => {
  await deps.users.unlockUserAccount(userId);
};
