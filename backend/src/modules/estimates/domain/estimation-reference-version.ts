/**
 * SRC-01 — versionamento de evidencia (plano §4.5).
 * Atualizacao de title/uri que muda o fingerprint gera nova versao;
 * nunca reescreve o insumo antigo. Coletor local-git e so mapper de metadados.
 */

import { createHash } from 'node:crypto';
import type { EstimationReferenceKind } from './estimation-reference.js';

export const computeEvidenceContentFingerprint = (input: {
  title?: string | null;
  uri?: string | null;
}): string => {
  const payload = `${input.title ?? ''}\n${input.uri ?? ''}`;
  return createHash('sha256').update(payload).digest('hex');
};

export const shouldCreateEvidenceVersion = (input: {
  existingFingerprint: string | null | undefined;
  nextFingerprint: string;
}): boolean => {
  if (input.existingFingerprint == null || input.existingFingerprint === '') return false;
  return input.existingFingerprint !== input.nextFingerprint;
};

export const nextEvidenceVersion = (versions: number[]): number => {
  if (versions.length === 0) return 1;
  return Math.max(...versions) + 1;
};

export type LocalGitCommitMeta = {
  sha: string;
  message: string;
  repository: string;
  /** Autor Git (e-mail); nao e identidade TT ate mapa/self-claim. */
  authorEmail?: string | null;
  authorName?: string | null;
};

/** Metadados git locais → Input de EstimationReference (sem host/IdP). */
export const buildLocalGitCommitReferenceInput = (
  meta: LocalGitCommitMeta
): {
  provider: 'local-git';
  kind: EstimationReferenceKind;
  externalId: string;
  repository: string;
  title: string;
  authorEmail: string | null;
  authorName: string | null;
  presentAsActualTracked: false;
} => {
  const sha = meta.sha.trim();
  if (!sha) throw new Error('LOCAL_GIT_SHA_REQUIRED');
  const authorEmail = String(meta.authorEmail ?? '').trim() || null;
  const authorName = String(meta.authorName ?? '').trim().slice(0, 200) || null;
  return {
    provider: 'local-git',
    kind: 'COMMIT',
    externalId: sha,
    repository: meta.repository.trim(),
    title: meta.message.trim().slice(0, 500),
    authorEmail,
    authorName,
    presentAsActualTracked: false,
  };
};
