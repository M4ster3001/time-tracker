/**
 * Pure client validation for TRK-01 workspace import form.
 * Mirrors backend `buildImportedTrackingSession` gates; does not invent idle policy.
 */

export type TrackingImportFormInput = {
  externalId: string;
  startedAtLocal: string;
  endedAtLocal: string;
  timeEntryIdRaw: string;
  accumulatedPausedMsRaw: string;
};

export type TrackingImportPayload = {
  externalId: string;
  startedAt: string;
  endedAt: string;
  timeEntryId: number | null;
  accumulatedPausedMs?: number;
};

export type TrackingImportBuildResult =
  | { ok: true; payload: TrackingImportPayload }
  | {
      ok: false;
      code:
        | 'TRACKING_EXTERNAL_ID_REQUIRED'
        | 'TRACKING_IMPORT_STARTED_AT_INVALID'
        | 'TRACKING_IMPORT_ENDED_AT_INVALID'
        | 'TRACKING_IMPORT_RANGE_INVALID'
        | 'TRACKING_IMPORT_PAUSE_EXCEEDS_RANGE'
        | 'TRACKING_IMPORT_TIME_ENTRY_ID_INVALID'
        | 'TRACKING_IMPORT_PAUSE_INVALID';
    };

const parseLocalDateTime = (value: string): Date | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const buildTrackingImportPayload = (
  input: TrackingImportFormInput
): TrackingImportBuildResult => {
  const externalId = input.externalId.trim();
  if (!externalId) return { ok: false, code: 'TRACKING_EXTERNAL_ID_REQUIRED' };

  const startedAt = parseLocalDateTime(input.startedAtLocal);
  if (!startedAt) return { ok: false, code: 'TRACKING_IMPORT_STARTED_AT_INVALID' };

  const endedAt = parseLocalDateTime(input.endedAtLocal);
  if (!endedAt) return { ok: false, code: 'TRACKING_IMPORT_ENDED_AT_INVALID' };

  if (endedAt.getTime() < startedAt.getTime()) {
    return { ok: false, code: 'TRACKING_IMPORT_RANGE_INVALID' };
  }

  const timeEntryTrim = input.timeEntryIdRaw.trim();
  let timeEntryId: number | null = null;
  if (timeEntryTrim) {
    const parsed = Number(timeEntryTrim);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      return { ok: false, code: 'TRACKING_IMPORT_TIME_ENTRY_ID_INVALID' };
    }
    timeEntryId = parsed;
  }

  const pauseTrim = input.accumulatedPausedMsRaw.trim();
  let accumulatedPausedMs: number | undefined;
  if (pauseTrim) {
    const parsed = Number(pauseTrim);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, code: 'TRACKING_IMPORT_PAUSE_INVALID' };
    }
    accumulatedPausedMs = Math.floor(parsed);
    const wallMs = endedAt.getTime() - startedAt.getTime();
    if (accumulatedPausedMs > wallMs) {
      return { ok: false, code: 'TRACKING_IMPORT_PAUSE_EXCEEDS_RANGE' };
    }
  }

  return {
    ok: true,
    payload: {
      externalId,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      timeEntryId,
      ...(accumulatedPausedMs != null ? { accumulatedPausedMs } : {}),
    },
  };
};
