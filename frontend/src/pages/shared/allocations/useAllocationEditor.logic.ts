import type { AllocationDraft, AllocationRow } from './allocation.types';

export const emptyDraft = (): AllocationDraft => ({
  allocationType: 'DAILY',
  hours: '',
  hourlyRate: '',
});

/** Converte a alocacao salva (vinda da API) no draft editavel exibido na tabela. */
export const draftFromRow = (row: AllocationRow): AllocationDraft => {
  if (!row.allocation) return emptyDraft();
  const { allocationType } = row.allocation;
  const hours =
    allocationType === 'DAILY'
      ? String(row.allocation.hoursPerDay ?? '')
      : String(row.allocation.hoursPerMonth ?? '');
  return { allocationType, hours, hourlyRate: String(row.allocation.hourlyRate ?? '') };
};

export const draftsFromRows = (rows: AllocationRow[]): Record<number, AllocationDraft> => {
  const drafts: Record<number, AllocationDraft> = {};
  rows.forEach((row) => {
    drafts[row.clientId] = draftFromRow(row);
  });
  return drafts;
};

export interface AllocationPayload {
  allocationType: AllocationDraft['allocationType'];
  hoursPerDay: number | null;
  hoursPerMonth: number | null;
  hourlyRate: number | null;
}

/** Valida o draft e monta o payload de PUT; retorna null se as horas informadas forem invalidas. */
export const buildDraftPayload = (draft: AllocationDraft | undefined): AllocationPayload | null => {
  if (!draft) return null;
  const trimmedHours = draft.hours.trim();
  if (!trimmedHours) return null;
  const hoursValue = Number(trimmedHours);
  if (!Number.isFinite(hoursValue)) return null;

  const trimmedRate = draft.hourlyRate.trim();
  const hourlyRateValue = trimmedRate === '' ? null : Number(trimmedRate);
  if (trimmedRate !== '' && !Number.isFinite(hourlyRateValue)) return null;

  return {
    allocationType: draft.allocationType,
    hoursPerDay: draft.allocationType === 'DAILY' ? hoursValue : null,
    hoursPerMonth: draft.allocationType === 'MONTHLY' ? hoursValue : null,
    hourlyRate: hourlyRateValue,
  };
};

/** Meta mensal (em minutos) projetada a partir do draft, usada na coluna "Meta mensal". */
export const computeMonthlyTargetMinutes = (
  draft: AllocationDraft,
  workingDays: number
): number => {
  const hoursValue = Number(draft.hours);
  if (!(hoursValue > 0)) return 0;
  return draft.allocationType === 'DAILY'
    ? Math.round(hoursValue * workingDays * 60)
    : Math.round(hoursValue * 60);
};
