import { randomUUID } from 'crypto';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import fs from 'node:fs';
import path from 'node:path';
import { selectLegacyDedupeKeyOnlyIndexNames } from '../domain/estimation-reference-sqlite-unique.js';

/**
 * Bancos SQLite locais criados por instalacoes anteriores a fundacao do sync
 * nao tem as colunas `uuid`/`deletedAt`. ensureDesktopDatabase (main/index.mjs)
 * so copia o template.db quando o arquivo do usuario ainda nao existe, entao
 * um upgrade do app nunca atualiza o schema de quem ja tinha o banco criado --
 * por isso esta migracao roda no boot, em modo desktop, e preserva os dados
 * existentes (so adiciona coluna e faz backfill, nunca remove nada).
 */

interface ColumnInfo {
  name: string;
}

const hasColumn = async (table: string, column: string): Promise<boolean> => {
  const rows = await prisma.$queryRawUnsafe<ColumnInfo[]>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
};

/**
 * Defesa extra contra corrida (ex.: duas instancias do app rodando ao mesmo
 * tempo, ambas verificando a coluna antes de qualquer uma adiciona-la): se o
 * ADD COLUMN falhar porque a coluna ja existe, ignora em vez de derrubar o
 * processo inteiro. O guard requestSingleInstanceLock (main/index.mjs) evita
 * que isso aconteca no uso normal, mas essa funcao fica segura de qualquer forma.
 */
const addColumnIfMissing = async (table: string, column: string, ddl: string): Promise<boolean> => {
  if (await hasColumn(table, column)) return false;

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/duplicate column name/i.test(message)) {
      logger.warn(`[DESKTOP_MIGRATE] ${table}.${column} ja existia (corrida evitada)`);
      return false;
    }
    throw error;
  }
};

const addUuidColumn = async (table: string): Promise<void> => {
  const added = await addColumnIfMissing(table, 'uuid', 'uuid TEXT');
  if (!added) return;

  logger.warn(`[DESKTOP_MIGRATE] adicionando coluna uuid em ${table}`);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(`SELECT id FROM ${table}`);
  for (const row of rows) {
    await prisma.$executeRawUnsafe(`UPDATE ${table} SET uuid = ? WHERE id = ?`, randomUUID(), row.id);
  }

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_uuid_key ON ${table}(uuid)`
  );
};

const migrateEstimationReferenceDedupeUnique = async (): Promise<void> => {
  const tableExists = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'estimation_references'`
  );
  if (tableExists.length === 0) return;

  const indexRows = await prisma.$queryRawUnsafe<Array<{ name: string; unique: number }>>(
    `PRAGMA index_list('estimation_references')`
  );
  const withColumns = [];
  for (const row of indexRows) {
    const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA index_info('${row.name.replace(/'/g, "''")}')`
    );
    withColumns.push({
      index: { name: row.name, unique: row.unique === 1 },
      columns: columns.map((c) => ({ name: c.name })),
    });
  }

  for (const name of selectLegacyDedupeKeyOnlyIndexNames(withColumns)) {
    logger.warn(`[DESKTOP_MIGRATE] drop legacy UNIQUE(dedupeKey) index ${name}`);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${name.replace(/"/g, '""')}"`);
  }

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS estimation_references_dedupeKey_evidenceVersion_key
     ON estimation_references(dedupeKey, evidenceVersion)`
  );
};

export const runDesktopSchemaUpgrades = async (): Promise<void> => {
  await addUuidColumn('users');
  await addUuidColumn('clients');
  await addUuidColumn('time_entries');
  await addColumnIfMissing('time_entries', 'syncBaseUpdatedAt', 'syncBaseUpdatedAt INTEGER');
  await addColumnIfMissing('time_entries', 'source', "source TEXT NOT NULL DEFAULT 'PORTAL'");
  // DAT-01: colunas aditivas; sem backfill de confirmacao/medicao ficticia.
  await addColumnIfMissing('time_entries', 'estimatedDurationMinutes', 'estimatedDurationMinutes INTEGER');
  await addColumnIfMissing('time_entries', 'confirmedDurationMinutes', 'confirmedDurationMinutes INTEGER');
  await addColumnIfMissing(
    'time_entries',
    'actualTrackedDurationMinutes',
    'actualTrackedDurationMinutes INTEGER'
  );
  await addColumnIfMissing('time_entries', 'confirmedAt', 'confirmedAt INTEGER');
  await addColumnIfMissing('time_entries', 'confirmedByUserId', 'confirmedByUserId INTEGER');
  await addColumnIfMissing('time_entries', 'projectId', 'projectId INTEGER');
  await addColumnIfMissing(
    'clients',
    'requireProjectOnEntries',
    'requireProjectOnEntries INTEGER NOT NULL DEFAULT 0'
  );
  await addColumnIfMissing('users', 'accessMode', "accessMode TEXT NOT NULL DEFAULT 'LEGACY'");
  await addColumnIfMissing('users', 'locale', "locale TEXT NOT NULL DEFAULT 'pt-BR'");
  const addedDeletedAt = await addColumnIfMissing('time_entries', 'deletedAt', 'deletedAt INTEGER');

  // New tables/indexes come only from the packaged, generated schema. Existing
  // tables are never dropped or replaced during a desktop upgrade.
  const ddl = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.desktop.sql'), 'utf8');
  for (const match of ddl.matchAll(/CREATE (?:TABLE|(?:UNIQUE )?INDEX)[\s\S]*?;/g)) {
    const statement = match[0].replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ')
      .replace(/^CREATE INDEX /, 'CREATE INDEX IF NOT EXISTS ')
      .replace(/^CREATE UNIQUE INDEX /, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
    await prisma.$executeRawUnsafe(statement);
  }
  await addColumnIfMissing('personal_access_tokens', 'grantsJson', 'grantsJson TEXT');

  // EST-02 / TRK-01 / SRC-01 / CAL-01: tabelas aditivas (SQLite desktop).
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS duration_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      timeEntryId INTEGER NOT NULL,
      version INTEGER NOT NULL,
      confirmedMinutes INTEGER NOT NULL,
      estimatedMinutesSnapshot INTEGER,
      justification TEXT,
      confirmedByUserId INTEGER NOT NULL,
      confirmedAt INTEGER NOT NULL,
      previousConfirmationId INTEGER,
      createdAt INTEGER NOT NULL,
      UNIQUE(timeEntryId, version)
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS estimation_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      kind TEXT NOT NULL,
      externalId TEXT NOT NULL,
      repository TEXT,
      dedupeKey TEXT NOT NULL,
      evidenceVersion INTEGER NOT NULL DEFAULT 1,
      contentFingerprint TEXT,
      previousReferenceId INTEGER,
      title TEXT,
      uri TEXT,
      timeEntryId INTEGER,
      projectId INTEGER,
      authorUserId INTEGER,
      collectedAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      UNIQUE(dedupeKey, evidenceVersion)
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tracking_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      userId INTEGER NOT NULL,
      timeEntryId INTEGER,
      state TEXT NOT NULL DEFAULT 'RUNNING',
      source TEXT NOT NULL DEFAULT 'TIMER',
      startedAt INTEGER NOT NULL,
      endedAt INTEGER,
      pausedAt INTEGER,
      accumulatedPausedMs INTEGER NOT NULL DEFAULT 0,
      externalId TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS calibration_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      taskTypeCode TEXT,
      parameterSetId INTEGER,
      sampleSize INTEGER NOT NULL,
      medianAbsErrorMinutes REAL,
      biasMinutes REAL,
      measuredSampleSize INTEGER NOT NULL DEFAULT 0,
      proposedBaseMinutes INTEGER,
      proposedFactor TEXT,
      justification TEXT,
      state TEXT NOT NULL DEFAULT 'DRAFT',
      authorUserId INTEGER NOT NULL,
      decidedByUserId INTEGER,
      decidedAt INTEGER,
      resultingRevisionId INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS work_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      clientId INTEGER NOT NULL,
      projectId INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      taskTypeId INTEGER,
      ownerUserId INTEGER,
      state TEXT NOT NULL DEFAULT 'OPEN',
      version INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS estimate_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      workActivityId INTEGER NOT NULL,
      version INTEGER NOT NULL,
      baseMinutes INTEGER NOT NULL,
      factor TEXT NOT NULL,
      rawMinutes TEXT NOT NULL,
      suggestedMinutes INTEGER NOT NULL,
      roundingMode TEXT NOT NULL DEFAULT 'NEAREST_MINUTE',
      parameterRevisionUuid TEXT,
      origin TEXT NOT NULL DEFAULT 'CATALOG',
      algorithmVersion TEXT NOT NULL DEFAULT 'EST-01',
      authorUserId INTEGER,
      reason TEXT,
      previousRevisionId INTEGER,
      createdAt INTEGER NOT NULL,
      UNIQUE(workActivityId, version)
    )
  `);
  await addColumnIfMissing('time_entries', 'workActivityId', 'workActivityId INTEGER');
  await addColumnIfMissing('duration_confirmations', 'workActivityId', 'workActivityId INTEGER');
  await addColumnIfMissing(
    'duration_confirmations',
    'estimateRevisionId',
    'estimateRevisionId INTEGER'
  );
  await addColumnIfMissing('calibration_proposals', 'parameterSetId', 'parameterSetId INTEGER');
  await addColumnIfMissing(
    'calibration_proposals',
    'resultingRevisionId',
    'resultingRevisionId INTEGER'
  );
  await addColumnIfMissing(
    'calibration_proposals',
    'targetClientId',
    'targetClientId INTEGER'
  );
  await addColumnIfMissing(
    'calibration_proposals',
    'targetProjectId',
    'targetProjectId INTEGER'
  );

  // PRJ-01 memberships + SRC-01 evidence version columns (SQLite desktop).
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS project_memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'MEMBER',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(projectId, userId)
    )
  `);
  await addColumnIfMissing('estimation_references', 'evidenceVersion', 'evidenceVersion INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('estimation_references', 'contentFingerprint', 'contentFingerprint TEXT');
  await addColumnIfMissing('estimation_references', 'previousReferenceId', 'previousReferenceId INTEGER');
  // SRC-01: installs anteriores tinham UNIQUE(dedupeKey); versionamento exige (dedupeKey, evidenceVersion).
  await migrateEstimationReferenceDedupeUnique();

  if (addedDeletedAt) {
    logger.warn('[DESKTOP_MIGRATE] adicionando coluna deletedAt em time_entries');
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS time_entries_updatedAt_idx ON time_entries(updatedAt)`
    );
  }
};
