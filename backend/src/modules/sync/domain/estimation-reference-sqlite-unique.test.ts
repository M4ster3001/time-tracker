import { describe, expect, it } from 'vitest';
import {
  isLegacyDedupeKeyOnlyUnique,
  selectLegacyDedupeKeyOnlyIndexNames,
} from './estimation-reference-sqlite-unique.js';

describe('SRC-01 estimation_references sqlite unique migration', () => {
  it('detecta UNIQUE so em dedupeKey como legado', () => {
    expect(
      isLegacyDedupeKeyOnlyUnique({ name: 'sqlite_autoindex_estimation_references_2', unique: true }, [
        { name: 'dedupeKey' },
      ])
    ).toBe(true);
  });

  it('nao trata UNIQUE(dedupeKey, evidenceVersion) como legado', () => {
    expect(
      isLegacyDedupeKeyOnlyUnique({ name: 'estimation_references_dedupeKey_evidenceVersion_key', unique: true }, [
        { name: 'dedupeKey' },
        { name: 'evidenceVersion' },
      ])
    ).toBe(false);
  });

  it('ignora indexes nao unicos', () => {
    expect(
      isLegacyDedupeKeyOnlyUnique({ name: 'estimation_references_dedupeKey_idx', unique: false }, [
        { name: 'dedupeKey' },
      ])
    ).toBe(false);
  });

  it('lista nomes legados para DROP INDEX', () => {
    expect(
      selectLegacyDedupeKeyOnlyIndexNames([
        {
          index: { name: 'legacy_dedupe', unique: true },
          columns: [{ name: 'dedupeKey' }],
        },
        {
          index: { name: 'composite', unique: true },
          columns: [{ name: 'dedupeKey' }, { name: 'evidenceVersion' }],
        },
      ])
    ).toEqual(['legacy_dedupe']);
  });
});
