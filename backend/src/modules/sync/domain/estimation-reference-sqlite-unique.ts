/**
 * SRC-01 — decides which SQLite indexes on estimation_references are the legacy
 * UNIQUE(dedupeKey) that must be dropped before UNIQUE(dedupeKey, evidenceVersion).
 */

export type SqliteIndexInfo = {
  name: string;
  unique: boolean;
};

export type SqliteIndexColumn = {
  name: string;
};

/** True when the index is unique and covers only dedupeKey (legacy single-column unique). */
export const isLegacyDedupeKeyOnlyUnique = (
  index: SqliteIndexInfo,
  columns: SqliteIndexColumn[]
): boolean => {
  if (!index.unique) return false;
  if (columns.length !== 1) return false;
  return columns[0]?.name === 'dedupeKey';
};

export const selectLegacyDedupeKeyOnlyIndexNames = (
  indexes: Array<{ index: SqliteIndexInfo; columns: SqliteIndexColumn[] }>
): string[] =>
  indexes
    .filter(({ index, columns }) => isLegacyDedupeKeyOnlyUnique(index, columns))
    .map(({ index }) => index.name);
