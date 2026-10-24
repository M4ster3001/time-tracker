import { exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import * as zlib from 'zlib';
import { config } from '../../../config.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import {
  isDesktopRuntime,
  resolveDesktopDatabasePath,
} from '../../../shared/infrastructure/runtime/app-runtime.js';
import type { BackupAuditRepository } from '../domain/repositories/backup-audit.repository.js';
import type { BackupProviderAdapter, BackupResult } from '../domain/providers/backup-provider.js';

const execAsync = promisify(exec);
const gzipAsync = promisify(zlib.gzip);

export interface BackupMetadata {
  id: number;
  filename: string;
  providers: string[];
  size: number;
  status: 'success' | 'partial' | 'failed';
  createdAt: Date;
  results: BackupResult[];
}

interface BackupRuntimeStatus {
  schedulerInitialized: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastStatus: 'success' | 'partial' | 'failed' | null;
  lastError: string | null;
  lastTrigger: 'manual' | 'scheduled' | null;
}

let scheduledTask: { stop(): void } | null = null;
let providers: BackupProviderAdapter[] = [];
const runtimeStatus: BackupRuntimeStatus = {
  schedulerInitialized: false,
  running: false,
  lastRunAt: null,
  lastDurationMs: null,
  lastStatus: null,
  lastError: null,
  lastTrigger: null,
};

const generateFilename = (): string => {
  const now = new Date();
  const pad = (value: number): string => value.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return isDesktopRuntime() ? `backup-${timestamp}.db.gz` : `backup-${timestamp}.sql.gz`;
};

const parseDatabaseUrl = () => {
  const url = new URL(config.database.url);
  return {
    host: url.hostname,
    port: url.port || '3306',
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
  };
};

const createDesktopDatabaseDump = async (): Promise<Buffer> => {
  const dbPath = resolveDesktopDatabasePath();
  if (!existsSync(dbPath)) {
    throw new Error(`Desktop database file not found: ${dbPath}`);
  }

  const contents = readFileSync(dbPath);
  return (await gzipAsync(contents)) as Buffer;
};

const createServerDatabaseDump = async (): Promise<Buffer> => {
  const db = parseDatabaseUrl();
  const env = { ...process.env, MYSQL_PWD: db.password };
  const command = `mariadb-dump -h ${db.host} -P ${db.port} -u ${db.user} --single-transaction --routines --triggers --events --no-tablespaces ${db.database}`;

  try {
    const { stdout } = await execAsync(command, { env, maxBuffer: 100 * 1024 * 1024 });
    return (await gzipAsync(Buffer.from(stdout, 'utf-8'))) as Buffer;
  } catch (error) {
    logger.error({ err: error }, '[BACKUP] mariadb-dump failed');
    throw new Error(
      `Database dump failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

const createDatabaseDump = async (): Promise<Buffer> => {
  if (isDesktopRuntime()) {
    return createDesktopDatabaseDump();
  }

  return createServerDatabaseDump();
};

const uploadToProviders = async (filename: string, data: Buffer): Promise<BackupResult[]> => {
  const results: BackupResult[] = [];

  for (const provider of providers) {
    try {
      logger.info(`[BACKUP] Uploading to ${provider.name}...`);
      const result = await provider.upload(filename, data);
      results.push(result);
      if (result.success) {
        logger.info(`[BACKUP] Successfully uploaded to ${provider.name}: ${result.path}`);
      } else {
        logger.error(`[BACKUP] Failed to upload to ${provider.name}: ${result.error}`);
      }
    } catch (error) {
      results.push({
        success: false,
        provider: provider.name,
        path: filename,
        size: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
};

const cleanupOldBackups = async (): Promise<void> => {
  const retentionMs = config.backup.retentionDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - retentionMs);

  for (const provider of providers) {
    try {
      const files = await provider.list();
      for (const filename of files) {
        const match = filename.match(/backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
        if (!match) continue;
        const fileDate = new Date(
          match[1].replace(/-/g, (value, index) => (index > 9 ? ':' : value))
        );
        if (fileDate < cutoffDate) {
          logger.info(`[BACKUP] Deleting old backup: ${filename} from ${provider.name}`);
          await provider.delete(filename);
        }
      }
    } catch (error) {
      logger.error({ err: error }, `[BACKUP] Cleanup failed for ${provider.name}`);
    }
  }
};

export const executeBackup = async (deps: {
  auditRepository: BackupAuditRepository;
  providersFactory: () => BackupProviderAdapter[];
}): Promise<BackupMetadata> => {
  if (providers.length === 0) {
    providers = deps.providersFactory();
  }

  const filename = generateFilename();
  const startedAt = Date.now();
  runtimeStatus.running = true;
  runtimeStatus.lastError = null;
  logger.info(`[BACKUP] Starting backup: ${filename}`);

  try {
    const dumpData = await createDatabaseDump();
    const results = await uploadToProviders(filename, dumpData);
    await deps.auditRepository.logBackupResult(filename, results);
    await cleanupOldBackups();

    const successCount = results.filter((result) => result.success).length;
    const status =
      successCount === results.length ? 'success' : successCount > 0 ? 'partial' : 'failed';

    runtimeStatus.lastRunAt = new Date().toISOString();
    runtimeStatus.lastDurationMs = Date.now() - startedAt;
    runtimeStatus.lastStatus = status;
    runtimeStatus.running = false;

    return {
      id: Date.now(),
      filename,
      providers: results.map((result) => result.provider),
      size: dumpData.length,
      status,
      createdAt: new Date(),
      results,
    };
  } catch (error) {
    runtimeStatus.lastRunAt = new Date().toISOString();
    runtimeStatus.lastDurationMs = Date.now() - startedAt;
    runtimeStatus.lastStatus = 'failed';
    runtimeStatus.lastError = error instanceof Error ? error.message : 'Unknown error';
    runtimeStatus.running = false;
    await deps.auditRepository.logBackupFailure(filename, runtimeStatus.lastError);
    throw error;
  }
};

export const initBackupScheduler = async (deps: {
  providersFactory: () => BackupProviderAdapter[];
  triggerManualBackup: () => Promise<BackupMetadata>;
}): Promise<void> => {
  if (!config.backup.enabled) {
    logger.info('[BACKUP] Backup service is disabled');
    runtimeStatus.schedulerInitialized = false;
    return;
  }

  providers = deps.providersFactory();
  logger.info(
    `[BACKUP] Initialized with providers: ${providers.map((provider) => provider.name).join(', ')}`
  );

  try {
    const cron = await (eval('import("node-cron")') as Promise<{
      validate(expr: string): boolean;
      schedule(expr: string, fn: () => Promise<void>): { stop(): void };
    }>);
    if (!cron.validate(config.backup.schedule)) {
      logger.error(`[BACKUP] Invalid cron schedule: ${config.backup.schedule}`);
      return;
    }

    scheduledTask = cron.schedule(config.backup.schedule, async () => {
      runtimeStatus.lastTrigger = 'scheduled';
      logger.info('[BACKUP] Scheduled backup triggered');
      try {
        await deps.triggerManualBackup();
      } catch (error) {
        logger.error({ err: error }, '[BACKUP] Scheduled backup failed');
      }
    });

    runtimeStatus.schedulerInitialized = true;
  } catch {
    runtimeStatus.schedulerInitialized = false;
    runtimeStatus.lastError = 'node-cron not installed';
    logger.warn('[BACKUP] node-cron not installed. Run: npm install node-cron');
  }
};

export const stopBackupScheduler = (): void => {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('[BACKUP] Scheduler stopped');
  }
};

export const getBackupStatus = async (): Promise<{
  enabled: boolean;
  schedule: string;
  providers: string[];
  retentionDays: number;
  recentBackups: Array<{ filename: string; provider: string }>;
}> => {
  const recentBackups: Array<{ filename: string; provider: string }> = [];
  for (const provider of providers) {
    try {
      const files = await provider.list();
      for (const file of files.slice(-10)) {
        recentBackups.push({ filename: file, provider: provider.name });
      }
    } catch {
      // ignore
    }
  }

  return {
    enabled: config.backup.enabled,
    schedule: config.backup.schedule,
    providers: providers.map((provider) => provider.name),
    retentionDays: config.backup.retentionDays,
    recentBackups: recentBackups.sort((left, right) => right.filename.localeCompare(left.filename)),
  };
};

export const triggerManualBackup = (deps: {
  auditRepository: BackupAuditRepository;
  providersFactory: () => BackupProviderAdapter[];
}): Promise<BackupMetadata> => {
  runtimeStatus.lastTrigger = 'manual';
  logger.info('[BACKUP] Manual backup triggered');
  return executeBackup(deps);
};

export const getBackupRuntimeStatus = (): BackupRuntimeStatus => ({ ...runtimeStatus });

export const getBackupDependencyStatus = async (): Promise<{
  dumpCommandAvailable: boolean;
  dumpCommand: 'mariadb-dump' | 'mysqldump' | 'sqlite-file' | null;
  backupPathExists: boolean;
  details: string[];
}> => {
  const details: string[] = [];

  if (isDesktopRuntime()) {
    const dbPath = resolveDesktopDatabasePath();
    const backupPathExists = existsSync(config.backup.local.path);
    if (!backupPathExists) {
      await mkdir(path.resolve(config.backup.local.path), { recursive: true }).catch(
        () => undefined
      );
      if (!existsSync(config.backup.local.path)) {
        details.push(`Backup path does not exist: ${config.backup.local.path}`);
      }
    }
    if (!existsSync(dbPath)) {
      details.push(`Desktop database file not found: ${dbPath}`);
    }

    return {
      dumpCommandAvailable: existsSync(dbPath),
      dumpCommand: 'sqlite-file',
      backupPathExists: existsSync(config.backup.local.path),
      details,
    };
  }

  let dumpCommandAvailable = false;
  let dumpCommand: 'mariadb-dump' | 'mysqldump' | null = null;

  try {
    await execAsync('mariadb-dump --version');
    dumpCommandAvailable = true;
    dumpCommand = 'mariadb-dump';
  } catch {
    try {
      await execAsync('mysqldump --version');
      dumpCommandAvailable = true;
      dumpCommand = 'mysqldump';
    } catch {
      details.push('dump command not available in runtime (mariadb-dump/mysqldump)');
    }
  }

  const backupPathExists = existsSync(config.backup.local.path);
  if (!backupPathExists) {
    details.push(`Backup path does not exist: ${config.backup.local.path}`);
  }

  return { dumpCommandAvailable, dumpCommand, backupPathExists, details };
};
