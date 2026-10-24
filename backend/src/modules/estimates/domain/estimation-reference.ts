/**
 * SRC-01 — evidencias commit/PR/issue como EstimationReference (plano §4.5).
 * Nunca apresentadas como Actual Tracked Duration.
 */

export type EstimationReferenceKind = 'COMMIT' | 'PULL_REQUEST' | 'ISSUE' | 'DOCUMENT' | 'MANUAL';

export type EstimationReferenceInput = {
  provider: string;
  kind: EstimationReferenceKind;
  externalId: string;
  repository?: string | null;
};

export const buildEstimationReferenceKey = (input: EstimationReferenceInput): string => {
  const provider = input.provider.trim().toLowerCase();
  const repo = (input.repository ?? '').trim().toLowerCase();
  const externalId = input.externalId.trim().toLowerCase();
  return `${provider}:${input.kind}:${repo}:${externalId}`;
};

export const assertReferenceNotActualTracked = (input: {
  kind: EstimationReferenceKind;
  presentAsActualTracked: boolean;
}): void => {
  if (input.presentAsActualTracked) {
    throw new Error('REFERENCE_NOT_ACTUAL_TRACKED');
  }
};

export type EstimationReferenceRow = {
  id: number;
  uuid: string;
  provider: string;
  kind: EstimationReferenceKind | string;
  externalId: string;
  repository: string | null;
  title: string | null;
  uri: string | null;
  collectedAt: Date;
};

export type EstimationReferenceHistoryItem = EstimationReferenceRow & {
  /** Sempre false: commits/PRs/issues nunca sao Actual Tracked Duration. */
  isActualTrackedEvidence: false;
  disclaimer: string;
};

export const REFERENCE_NOT_ACTUAL_TRACKED_DISCLAIMER =
  'EstimationReference is evidence input only — not Actual Tracked Duration';

export const toEstimationReferenceHistoryItem = (
  row: EstimationReferenceRow
): EstimationReferenceHistoryItem => ({
  id: row.id,
  uuid: row.uuid,
  provider: row.provider,
  kind: row.kind,
  externalId: row.externalId,
  repository: row.repository,
  title: row.title,
  uri: row.uri,
  collectedAt: row.collectedAt,
  isActualTrackedEvidence: false,
  disclaimer: REFERENCE_NOT_ACTUAL_TRACKED_DISCLAIMER,
});
