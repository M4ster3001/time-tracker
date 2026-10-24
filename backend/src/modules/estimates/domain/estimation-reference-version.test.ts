import { describe, expect, it } from 'vitest';
import {
  buildLocalGitCommitReferenceInput,
  computeEvidenceContentFingerprint,
  nextEvidenceVersion,
  shouldCreateEvidenceVersion,
} from './estimation-reference-version.js';

describe('SRC-01 evidence versioning', () => {
  it('fingerprint muda quando title/uri mudam', () => {
    const a = computeEvidenceContentFingerprint({
      title: 'Fix login',
      uri: 'https://example/commit/abc',
    });
    const b = computeEvidenceContentFingerprint({
      title: 'Fix login (rebase)',
      uri: 'https://example/commit/abc',
    });
    expect(a).not.toBe(b);
  });

  it('cria nova versao quando fingerprint muda; reutiliza quando igual', () => {
    expect(
      shouldCreateEvidenceVersion({
        existingFingerprint: 'aaa',
        nextFingerprint: 'bbb',
      })
    ).toBe(true);
    expect(
      shouldCreateEvidenceVersion({
        existingFingerprint: 'aaa',
        nextFingerprint: 'aaa',
      })
    ).toBe(false);
    expect(
      shouldCreateEvidenceVersion({
        existingFingerprint: null,
        nextFingerprint: 'aaa',
      })
    ).toBe(false);
  });

  it('proxima versao = max + 1', () => {
    expect(nextEvidenceVersion([])).toBe(1);
    expect(nextEvidenceVersion([1, 3, 2])).toBe(4);
  });

  it('mapper local-git nao inventa Actual Tracked nem host remoto', () => {
    const input = buildLocalGitCommitReferenceInput({
      sha: 'abc123def',
      message: 'feat: timer',
      repository: 'C:/repos/time-tracker',
      authorEmail: '  test-user-1@example.test ',
      authorName: ' Ada Lovelace ',
    });
    expect(input).toEqual({
      provider: 'local-git',
      kind: 'COMMIT',
      externalId: 'abc123def',
      repository: 'C:/repos/time-tracker',
      title: 'feat: timer',
      authorEmail: 'test-user-1@example.test',
      authorName: 'Ada Lovelace',
      presentAsActualTracked: false,
    });
  });
});
