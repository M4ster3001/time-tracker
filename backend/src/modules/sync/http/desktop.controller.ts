import type { NextFunction, Request, Response } from 'express';
import { config } from '../../../config.js';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { hashPassword, comparePassword } from '../../../shared/infrastructure/crypto/password.js';
import { generateToken } from '../../../shared/infrastructure/crypto/jwt.js';
import { createRefreshToken } from '../../../services/refresh-token.service.js';
import { sendSuccess } from '../../../app/http/presenters/api.presenter.js';
import { BadRequestError, UnauthorizedError } from '../../../app/errors/app-error.js';
import {
  getDesktopSettings,
  getPublicDesktopSettings,
  updateDesktopSettings,
} from '../application/desktop-settings.js';
import { remoteLogin, remotePull } from '../application/remote-client.js';
import { applyAccess, runSyncCycle, reconcileUserIdentity } from '../application/sync-engine.js';
import {
  createBackup,
  listBackups,
  resolveBackupDir,
  restoreBackup,
} from '../application/backup.service.js';

const ensureDesktop = (): void => {
  if (!config.desktopMode) {
    throw new BadRequestError('Disponivel apenas no aplicativo desktop');
  }
};

const issueLocalSession = async (
  req: Request,
  res: Response,
  user: { id: number; email: string; roleId: number }
) => {
  const token = generateToken({ userId: user.id, email: user.email, roleId: user.roleId });
  const refresh = await createRefreshToken(user.id, {
    userAgent: req.get('user-agent') ?? null,
    ip: req.ip || null,
    deviceLabel: 'desktop',
  });
  res.cookie(config.refresh.cookieName, refresh.token, {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    maxAge: config.refresh.ttlDays * 24 * 60 * 60 * 1000,
  });
  return token;
};

export const getSettingsController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureDesktop();
    sendSuccess(res, 200, getPublicDesktopSettings());
  } catch (error) {
    next(error);
  }
};

export const updateSettingsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureDesktop();
    const { backupDir } = req.body as { backupDir?: string };
    updateDesktopSettings({ backupDir: backupDir ?? getDesktopSettings().backupDir });
    sendSuccess(res, 200, getPublicDesktopSettings());
  } catch (error) {
    next(error);
  }
};

/**
 * Login online-first. Autentica no remoto (quando ha URL e conexao), espelha o
 * usuario no SQLite local com a mesma identidade (uuid) e uma senha local para
 * permitir login offline, guarda a sessao remota e dispara a sincronizacao.
 * Sem conexao, cai para o usuario espelhado local.
 */
export const connectController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureDesktop();
    const { remoteUrl, email, password } = req.body as {
      remoteUrl?: string;
      email: string;
      password: string;
    };
    const url = (remoteUrl || getDesktopSettings().remoteUrl || '').trim();
    if (!url) throw new BadRequestError('Informe a URL do servidor');

    try {
      const session = await remoteLogin(url, email, password);
      const access = await remotePull(url, session.accessToken, new Date().toISOString());
      if (!access.access || access.access.userUuid !== session.user.uuid) throw new UnauthorizedError('SYNC_ACCESS_UPGRADE_REQUIRED');
      const passwordHash = await hashPassword(password);

      // Se ja havia um usuario local com este e-mail (modo autonomo), ele assume
      // a identidade do remoto antes do upsert por uuid.
      await reconcileUserIdentity(session.user.uuid, session.user.email);

      // Espelha o usuario remoto localmente (mesma identidade uuid). A senha
      // digitada e gravada para permitir o login offline depois.
      const localUser = await prisma.user.upsert({
        where: { uuid: session.user.uuid },
        create: {
          uuid: session.user.uuid,
          name: session.user.name,
          email: session.user.email,
          roleId: session.user.roleId,
          passwordHash,
          accessMode: 'CUSTOM',
        },
        update: {
          name: session.user.name,
          email: session.user.email,
          roleId: session.user.roleId,
          passwordHash,
          accessMode: 'CUSTOM',
        },
        select: { id: true, email: true, roleId: true },
      });

      await applyAccess(access, session.user.uuid);

      updateDesktopSettings({
        remoteUrl: url,
        remoteRefreshToken: session.refreshToken,
        remoteUserUuid: session.user.uuid,
      });

      // Sincroniza em background (nao bloqueia o login).
      void runSyncCycle();

      const token = await issueLocalSession(req, res, localUser);
      sendSuccess(res, 200, {
        token,
        user: { id: localUser.id, email: localUser.email, roleId: localUser.roleId },
        mode: 'online',
      });
    } catch (_remoteError) {
      const message = _remoteError instanceof Error ? _remoteError.message : '';
      if (!/fetch failed|ECONNREFUSED|ENOTFOUND|network|timeout|aborted/i.test(message)) {
        throw new UnauthorizedError('Remote authentication or access verification failed');
      }
      // Offline: tenta o usuario espelhado local.
      const local = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true, email: true, roleId: true, passwordHash: true, uuid: true, isActive: true, deletedAt: true },
      });
      const settings = getDesktopSettings();
      const isMirrored = local && settings.remoteUserUuid === local.uuid;
      if (!local || !isMirrored || !local.isActive || local.deletedAt || !(await comparePassword(password, local.passwordHash))) {
        throw new UnauthorizedError(
          'Sem conexao com o servidor e sem sessao local valida para este usuario'
        );
      }
      const token = await issueLocalSession(req, res, local);
      sendSuccess(res, 200, {
        token,
        user: { id: local.id, email: local.email, roleId: local.roleId },
        mode: 'offline',
      });
    }
  } catch (error) {
    next(error);
  }
};

export const syncNowController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureDesktop();
    const result = await runSyncCycle();
    sendSuccess(res, 200, { ...result, settings: getPublicDesktopSettings() });
  } catch (error) {
    next(error);
  }
};

export const listBackupsController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureDesktop();
    sendSuccess(res, 200, { backupDir: resolveBackupDir(), backups: listBackups() });
  } catch (error) {
    next(error);
  }
};

export const createBackupController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureDesktop();
    sendSuccess(res, 201, await createBackup());
  } catch (error) {
    next(error);
  }
};

export const restoreBackupController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureDesktop();
    const { file, mode } = req.body as { file: string; mode: 'replace' | 'merge' };
    const result = await restoreBackup(file, mode);
    // Depois de restaurar, reconcilia com o remoto (se conectado).
    void runSyncCycle();
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
};
