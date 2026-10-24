/**
 * EST-02 — confirmacao humana versionada da duracao (plano §3 / §4.1).
 * Conserva estimativa; espelha confirmado em durationMinutes (compatibilidade).
 * Historico imutavel via DurationConfirmation (previousConfirmationId + version).
 */

export type ConfirmDurationInput = {
  durationMinutes: number;
  estimatedDurationMinutes?: number | null;
  confirmedDurationMinutes?: number | null;
  confirmedMinutes: number;
  actorUserId: number;
  now?: Date;
  previousConfirmationId?: number | null;
  previousConfirmationVersion?: number | null;
  justification?: string | null;
};

export type ConfirmDurationResult = {
  estimatedDurationMinutes: number | null;
  confirmedDurationMinutes: number;
  durationMinutes: number;
  confirmedAt: Date;
  confirmedByUserId: number;
  confirmationVersion: number;
  previousConfirmationId: number | null;
  justification: string | null;
};

export const nextConfirmationVersion = (
  previousVersion: number | null | undefined
): number => {
  if (previousVersion == null || !Number.isFinite(previousVersion) || previousVersion < 1) {
    return 1;
  }
  return Math.floor(previousVersion) + 1;
};

export const applyDurationConfirmation = (
  input: ConfirmDurationInput
): ConfirmDurationResult => {
  if (!Number.isFinite(input.confirmedMinutes) || input.confirmedMinutes < 0) {
    throw new Error('CONFIRMED_DURATION_INVALID');
  }
  const confirmed = Math.round(input.confirmedMinutes);
  const justification =
    input.justification == null || String(input.justification).trim() === ''
      ? null
      : String(input.justification).slice(0, 2000);

  return {
    estimatedDurationMinutes:
      input.estimatedDurationMinutes != null ? input.estimatedDurationMinutes : null,
    confirmedDurationMinutes: confirmed,
    durationMinutes: confirmed,
    confirmedAt: input.now ?? new Date(),
    confirmedByUserId: input.actorUserId,
    confirmationVersion: nextConfirmationVersion(input.previousConfirmationVersion),
    previousConfirmationId: input.previousConfirmationId ?? null,
    justification,
  };
};
