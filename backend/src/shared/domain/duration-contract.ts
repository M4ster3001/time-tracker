/**
 * DAT-01 — contrato das tres duracoes (plano de evolucao §3).
 *
 * durationMinutes permanece o campo de compatibilidade.
 * Registros sem campos estruturados sao LEGACY_DECLARED:
 * elegiveis ao fechamento atual, nunca rotulados como medidos/confirmados.
 */

export type DurationClassification = 'LEGACY_DECLARED' | 'STRUCTURED';

export type ActualTrackedStatus = 'NOT_TRACKED' | 'TRACKED' | 'TRACKED_ZERO';

export type DurationFields = {
  durationMinutes: number;
  estimatedDurationMinutes?: number | null;
  confirmedDurationMinutes?: number | null;
  actualTrackedDurationMinutes?: number | null;
};

export type TimeEntryDurationContract = {
  estimatedMinutes: number | null;
  confirmedMinutes: number | null;
  actualTrackedMinutes: number | null;
  legacyDeclaredMinutes: number | null;
  closingEligibleMinutes: number;
  actualTrackedStatus: ActualTrackedStatus;
  classification: DurationClassification;
};

export type DurationWriteInput = {
  actualTrackedDurationMinutes?: number | null;
  /** Origem proibida para inventar Actual Tracked Duration. */
  deriveActualFrom?: 'CALENDAR' | 'COMMIT' | 'AI' | 'TEXT' | null;
};

export const durationLabels = {
  estimated: { pt: 'Duração estimada', en: 'Estimated Duration' },
  confirmed: { pt: 'Duração confirmada', en: 'Confirmed Duration' },
  actualTracked: { pt: 'Duração medida', en: 'Actual Tracked Duration' },
  notTracked: { pt: 'Não medido', en: 'Not tracked' },
} as const;

const hasValue = (value: number | null | undefined): value is number => value != null;

export const closingEligibleMinutes = (entry: DurationFields): number => {
  if (hasValue(entry.confirmedDurationMinutes)) {
    return entry.confirmedDurationMinutes;
  }
  // Legado e apontamento ainda so com durationMinutes: elegivel como hoje.
  return entry.durationMinutes;
};

export const resolveActualTrackedStatus = (
  actualTrackedMinutes: number | null | undefined
): ActualTrackedStatus => {
  if (!hasValue(actualTrackedMinutes)) return 'NOT_TRACKED';
  return actualTrackedMinutes === 0 ? 'TRACKED_ZERO' : 'TRACKED';
};

export const toDurationContract = (entry: DurationFields): TimeEntryDurationContract => {
  const estimatedMinutes = hasValue(entry.estimatedDurationMinutes)
    ? entry.estimatedDurationMinutes
    : null;
  const confirmedMinutes = hasValue(entry.confirmedDurationMinutes)
    ? entry.confirmedDurationMinutes
    : null;
  const actualTrackedMinutes = hasValue(entry.actualTrackedDurationMinutes)
    ? entry.actualTrackedDurationMinutes
    : null;

  const isLegacy =
    estimatedMinutes === null && confirmedMinutes === null && actualTrackedMinutes === null;

  return {
    estimatedMinutes,
    confirmedMinutes,
    actualTrackedMinutes,
    legacyDeclaredMinutes: isLegacy ? entry.durationMinutes : null,
    closingEligibleMinutes: closingEligibleMinutes(entry),
    actualTrackedStatus: resolveActualTrackedStatus(actualTrackedMinutes),
    classification: isLegacy ? 'LEGACY_DECLARED' : 'STRUCTURED',
  };
};

export const assertDurationWriteInvariants = (input: DurationWriteInput): void => {
  if (hasValue(input.actualTrackedDurationMinutes) && input.deriveActualFrom != null) {
    throw new Error('ACTUAL_TRACKED_DERIVATION_FORBIDDEN');
  }
};

/** Anexa o contrato sem alterar totais legados do payload HTTP. */
export const withDurationContract = <T extends DurationFields>(
  entry: T
): T & { durations: TimeEntryDurationContract } => ({
  ...entry,
  durations: toDurationContract(entry),
});
