import { describe, expect, it } from 'vitest';
import {
  normalizeGitAuthorEmail,
  pickEstimationReferenceAuthorUserId,
  resolveGitAuthorUserId,
  type GitAuthorMapping,
} from './git-author-map.js';

describe('SRC-01 git author map (plano §4.5)', () => {
  it('normaliza email (trim + lower); rejeita vazio ou sem @', () => {
    expect(normalizeGitAuthorEmail('  Alice@Example.Test ')).toBe('alice@example.test');
    expect(normalizeGitAuthorEmail('')).toBeNull();
    expect(normalizeGitAuthorEmail('not-an-email')).toBeNull();
    expect(normalizeGitAuthorEmail(null)).toBeNull();
  });

  it('mapeia so com vinculo verified; nao cria usuario', () => {
    const mappings: GitAuthorMapping[] = [
      { gitEmail: 'owner@example.test', userId: 42, verified: true },
      { gitEmail: 'unverified@example.test', userId: 7, verified: false },
    ];
    expect(
      resolveGitAuthorUserId({
        gitEmail: 'owner@example.test',
        actorUserId: 1,
        actorEmail: 'actor@example.test',
        mappings,
      })
    ).toEqual({ status: 'mapped', userId: 42 });
    expect(
      resolveGitAuthorUserId({
        gitEmail: 'unverified@example.test',
        actorUserId: 1,
        actorEmail: 'actor@example.test',
        mappings,
      })
    ).toEqual({ status: 'unverified' });
  });

  it('self-claim: email git == email do ator autenticado conta como vinculo validado', () => {
    expect(
      resolveGitAuthorUserId({
        gitEmail: 'self@example.test',
        actorUserId: 9,
        actorEmail: 'self@example.test',
        mappings: [],
      })
    ).toEqual({ status: 'mapped', userId: 9 });
  });

  it('terceiro sem mapa → unmapped; ambiguo se dois verified no mesmo email', () => {
    expect(
      resolveGitAuthorUserId({
        gitEmail: 'stranger@example.test',
        actorUserId: 1,
        actorEmail: 'self@example.test',
        mappings: [],
      })
    ).toEqual({ status: 'unmapped' });
    expect(
      resolveGitAuthorUserId({
        gitEmail: 'shared@example.test',
        actorUserId: 1,
        actorEmail: 'self@example.test',
        mappings: [
          { gitEmail: 'shared@example.test', userId: 2, verified: true },
          { gitEmail: 'shared@example.test', userId: 3, verified: true },
        ],
      })
    ).toEqual({ status: 'ambiguous' });
  });

  it('authorUserId: git identity so quando mapped; senao null (nao atribui linker)', () => {
    expect(
      pickEstimationReferenceAuthorUserId({
        hasGitAuthorIdentity: true,
        resolved: { status: 'mapped', userId: 42 },
        fallbackActorUserId: 1,
      })
    ).toBe(42);
    expect(
      pickEstimationReferenceAuthorUserId({
        hasGitAuthorIdentity: true,
        resolved: { status: 'unmapped' },
        fallbackActorUserId: 1,
      })
    ).toBeNull();
    expect(
      pickEstimationReferenceAuthorUserId({
        hasGitAuthorIdentity: false,
        resolved: { status: 'unmapped' },
        fallbackActorUserId: 1,
      })
    ).toBe(1);
  });
});
