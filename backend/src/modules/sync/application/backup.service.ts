import fs from 'fs';
import path from 'path';
import { config } from '../../../config.js';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { BadRequestError } from '../../../app/errors/app-error.js';
import { getDesktopSettings } from './desktop-settings.js';

/**
 * Backup e restauracao do banco local (SQLite) do desktop.
 *
 * - Backup usa `VACUUM INTO`, que gera uma copia consistente sem parar o app.
 * - Restauracao usa `ATTACH DATABASE`, lendo o arquivo de backup na mesma
 *   conexao: "substituir" troca os dados pelos do backup, "mesclar" faz upsert
 *   por uuid com last-write-wins (o mais recente vence).
 */

const TABLES = ['users', 'clients', 'time_entries'] as const;

export const resolveBackupDir = (): string => {
  const configured = getDesktopSettings().backupDir;
  if (configured) return configured;
  return path.join(config.desktop.dataDir || process.cwd(), 'backups');
};

const sqlPath = (value: string): string => value.replace(/\\/g, '/').replace(/'/g, "''");

export interface BackupFile {
  name: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
}

export const listBackups = (): BackupFile[] => {
  const dir = resolveBackupDir();
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.db'))
    .map((name) => {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      return {
        name,
        path: full,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const createBackup = async (): Promise<BackupFile> => {
  const dir = resolveBackupDir();
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `time-tracker-${stamp}.db`);

  // VACUUM INTO gera uma copia integra mesmo com o app em uso.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${sqlPath(target)}'`);

  const stat = fs.statSync(target);
  logger.info(`[BACKUP] criado: ${target} (${stat.size} bytes)`);
  return {
    name: path.basename(target),
    path: target,
    sizeBytes: stat.size,
    createdAt: stat.mtime.toISOString(),
  };
};

/**
 * Garante que o backup e compativel (gerado apos a fundacao do sync, ou seja,
 * com a coluna uuid). Precisa rodar na MESMA conexao do ATTACH.
 */
type RawClient = { $queryRawUnsafe: (sql: string) => Promise<unknown> };

const assertCompatible = async (tx: RawClient): Promise<void> => {
  try {
    await tx.$queryRawUnsafe(`SELECT uuid FROM bak.time_entries LIMIT 1`);
  } catch {
    throw new BadRequestError(
      'Backup incompativel: foi gerado por uma versao anterior (sem identificador de sincronizacao).'
    );
  }
};

export const restoreBackup = async (
  file: string,
  mode: 'replace' | 'merge'
): Promise<{ mode: string; counts: Record<string, number> }> => {
  if (!fs.existsSync(file)) {
    throw new BadRequestError('Arquivo de backup nao encontrado');
  }

  const counts: Record<string, number> = {};

  // O SQLite nao permite ATTACH dentro de uma transacao, entao o attach fica
  // fora dela e a atomicidade e controlada com BEGIN/COMMIT crus (o conector
  // SQLite do Prisma usa uma unica conexao, entao o attach vale para todas as
  // chamadas seguintes).
  await prisma.$executeRawUnsafe(`DETACH DATABASE bak`).catch(() => undefined);
  await prisma.$executeRawUnsafe(`ATTACH DATABASE '${sqlPath(file)}' AS bak`);

  try {
    await assertCompatible(prisma);
    await prisma.$executeRawUnsafe(`BEGIN IMMEDIATE`);

    try {
      if (mode === 'replace') {
        // Ordem respeita as FKs: filhos primeiro na exclusao, pais primeiro na insercao.
        await prisma.$executeRawUnsafe(`DELETE FROM time_entries`);
        await prisma.$executeRawUnsafe(`DELETE FROM user_clients`);
        await prisma.$executeRawUnsafe(`DELETE FROM clients`);
        await prisma.$executeRawUnsafe(`DELETE FROM users`);

        await prisma.$executeRawUnsafe(`INSERT INTO users SELECT * FROM bak.users`);
        await prisma.$executeRawUnsafe(`INSERT INTO clients SELECT * FROM bak.clients`);
        await prisma.$executeRawUnsafe(`INSERT INTO user_clients SELECT * FROM bak.user_clients`);
        await prisma.$executeRawUnsafe(`INSERT INTO time_entries SELECT * FROM bak.time_entries`);
      } else {
        // Mescla por uuid; em conflito, o registro mais recente vence.
        await prisma.$executeRawUnsafe(
          `INSERT INTO users SELECT * FROM bak.users WHERE true
           ON CONFLICT(uuid) DO UPDATE SET
             name = excluded.name, email = excluded.email, roleId = excluded.roleId,
             isActive = excluded.isActive, deletedAt = excluded.deletedAt,
             updatedAt = excluded.updatedAt
           WHERE excluded.updatedAt > users.updatedAt`
        );
        await prisma.$executeRawUnsafe(
          `INSERT INTO clients SELECT * FROM bak.clients WHERE true
           ON CONFLICT(uuid) DO UPDATE SET
             name = excluded.name, code = excluded.code, isActive = excluded.isActive,
             deletedAt = excluded.deletedAt, updatedAt = excluded.updatedAt
           WHERE excluded.updatedAt > clients.updatedAt`
        );
        await prisma.$executeRawUnsafe(
          `INSERT INTO time_entries SELECT * FROM bak.time_entries WHERE true
           ON CONFLICT(uuid) DO UPDATE SET
             clientId = excluded.clientId, date = excluded.date,
             activityDescription = excluded.activityDescription,
             durationMinutes = excluded.durationMinutes,
             deletedAt = excluded.deletedAt, updatedAt = excluded.updatedAt
           WHERE excluded.updatedAt > time_entries.updatedAt`
        );
      }

      await prisma.$executeRawUnsafe(`COMMIT`);
    } catch (error) {
      await prisma.$executeRawUnsafe(`ROLLBACK`).catch(() => undefined);
      throw error;
    }

    for (const table of TABLES) {
      const rows = await prisma.$queryRawUnsafe<Array<{ c: number | bigint }>>(
        `SELECT COUNT(*) c FROM ${table}`
      );
      counts[table] = Number(rows[0].c);
    }
  } finally {
    await prisma.$executeRawUnsafe(`DETACH DATABASE bak`).catch(() => undefined);
  }

  logger.info(`[BACKUP] restaurado (${mode}): ${file} -> ${JSON.stringify(counts)}`);
  return { mode, counts };
};
