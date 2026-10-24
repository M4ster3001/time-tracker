/**
 * EST-02 — historico de confirmacoes e EstimateRevision para o painel "Como foi estimado".
 * Nao inventa Actual Tracked: so espelha o valor ja persistido no apontamento (ou null).
 * SRC-01 — EstimationReference entra como evidencia, nunca como medicao.
 */

import {
  toEstimationReferenceHistoryItem,
  type EstimationReferenceHistoryItem,
  type EstimationReferenceRow,
} from './estimation-reference.js';

export type DurationConfirmationRow = {
  id: number;
  uuid: string;
  version: number;
  confirmedMinutes: number;
  estimatedMinutesSnapshot: number | null;
  justification: string | null;
  confirmedByUserId: number;
  confirmedAt: Date;
  previousConfirmationId: number | null;
  estimateRevisionId: number | null;
  workActivityId: number | null;
};

export type EstimateRevisionRow = {
  id: number;
  uuid: string;
  version: number;
  baseMinutes: number;
  factor: number;
  rawMinutes: number;
  suggestedMinutes: number;
  roundingMode: string;
  parameterRevisionUuid: string | null;
  origin: string;
  algorithmVersion: string;
  authorUserId: number | null;
  reason: string | null;
  previousRevisionId: number | null;
  createdAt: Date;
};

export type DurationConfirmationHistoryItem = DurationConfirmationRow;

export type EstimateRevisionHistoryItem = EstimateRevisionRow & {
  formula: string;
};

export type TimeEntryEstimateHistory = {
  timeEntryId: number;
  workActivityId: number | null;
  /** Espelho do campo persistido; null = Nao medido. Nunca derivado de confirmacao/estimativa. */
  actualTrackedMinutes: number | null;
  durationConfirmations: DurationConfirmationHistoryItem[];
  estimateRevisions: EstimateRevisionHistoryItem[];
  estimationReferences: EstimationReferenceHistoryItem[];
};

export const toDurationConfirmationHistoryItem = (
  row: DurationConfirmationRow
): DurationConfirmationHistoryItem => ({
  id: row.id,
  uuid: row.uuid,
  version: row.version,
  confirmedMinutes: row.confirmedMinutes,
  estimatedMinutesSnapshot: row.estimatedMinutesSnapshot,
  justification: row.justification,
  confirmedByUserId: row.confirmedByUserId,
  confirmedAt: row.confirmedAt,
  previousConfirmationId: row.previousConfirmationId,
  estimateRevisionId: row.estimateRevisionId,
  workActivityId: row.workActivityId,
});

export const toEstimateRevisionHistoryItem = (
  row: EstimateRevisionRow
): EstimateRevisionHistoryItem => ({
  ...row,
  formula: `${row.baseMinutes} × ${row.factor} → ${row.suggestedMinutes} (${row.roundingMode})`,
});

export const buildTimeEntryEstimateHistory = (input: {
  timeEntryId: number;
  workActivityId: number | null;
  actualTrackedDurationMinutes: number | null | undefined;
  confirmations: DurationConfirmationRow[];
  estimateRevisions: EstimateRevisionRow[];
  estimationReferences?: EstimationReferenceRow[];
}): TimeEntryEstimateHistory => {
  const confirmations = [...input.confirmations]
    .sort((a, b) => b.version - a.version)
    .map(toDurationConfirmationHistoryItem);

  const estimateRevisions = [...input.estimateRevisions]
    .sort((a, b) => b.version - a.version)
    .map((row) =>
      toEstimateRevisionHistoryItem({
        ...row,
        factor: Number(row.factor),
        rawMinutes: Number(row.rawMinutes),
      })
    );

  const estimationReferences = [...(input.estimationReferences ?? [])]
    .sort((a, b) => b.collectedAt.getTime() - a.collectedAt.getTime())
    .map(toEstimationReferenceHistoryItem);

  return {
    timeEntryId: input.timeEntryId,
    workActivityId: input.workActivityId,
    actualTrackedMinutes:
      input.actualTrackedDurationMinutes == null ? null : input.actualTrackedDurationMinutes,
    durationConfirmations: confirmations,
    estimateRevisions,
    estimationReferences,
  };
};
