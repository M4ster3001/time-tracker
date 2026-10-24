/**
 * EST-01 — embute a ultima EstimateRevision no GET do lancamento.
 */

export type EstimateRevisionSummary = {
  id: number;
  uuid: string;
  version: number;
  baseMinutes: number;
  factor: number;
  suggestedMinutes: number;
  origin: string;
  algorithmVersion: string;
  createdAt: Date;
};

export const pickLatestEstimateRevision = (
  revisions: EstimateRevisionSummary[] | null | undefined
): EstimateRevisionSummary | null => {
  if (!revisions || revisions.length === 0) return null;
  return revisions.reduce((best, row) => (row.version > best.version ? row : best));
};

export const withEmbeddedEstimateRevision = <T extends object>(
  entry: T,
  revisions: EstimateRevisionSummary[] | null | undefined
): T & { estimateRevision: EstimateRevisionSummary | null } => ({
  ...entry,
  estimateRevision: pickLatestEstimateRevision(revisions),
});
