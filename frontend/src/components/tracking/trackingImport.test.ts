import { describe, expect, it } from 'vitest';
import {
  buildTrackingImportPayload,
  type TrackingImportFormInput,
} from './trackingImport';

const valid: TrackingImportFormInput = {
  externalId: 'tracker-abc-1',
  startedAtLocal: '2026-10-15T09:00',
  endedAtLocal: '2026-10-15T10:30',
  timeEntryIdRaw: '',
  accumulatedPausedMsRaw: '',
};

describe('buildTrackingImportPayload', () => {
  it('builds ISO body for a valid STOPPED import range', () => {
    const result = buildTrackingImportPayload(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.externalId).toBe('tracker-abc-1');
    expect(result.payload.timeEntryId).toBeNull();
    expect(result.payload.accumulatedPausedMs).toBeUndefined();
    expect(new Date(result.payload.startedAt).toISOString()).toBe(
      new Date(result.payload.startedAt).toISOString()
    );
    expect(new Date(result.payload.endedAt).getTime()).toBeGreaterThan(
      new Date(result.payload.startedAt).getTime()
    );
  });

  it('trims externalId and parses optional fields', () => {
    const result = buildTrackingImportPayload({
      ...valid,
      externalId: '  ext-9  ',
      timeEntryIdRaw: '42',
      accumulatedPausedMsRaw: '60000',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.externalId).toBe('ext-9');
    expect(result.payload.timeEntryId).toBe(42);
    expect(result.payload.accumulatedPausedMs).toBe(60_000);
  });

  it('rejects blank externalId', () => {
    const result = buildTrackingImportPayload({ ...valid, externalId: '   ' });
    expect(result).toEqual({ ok: false, code: 'TRACKING_EXTERNAL_ID_REQUIRED' });
  });

  it('rejects invalid datetime locals', () => {
    expect(
      buildTrackingImportPayload({ ...valid, startedAtLocal: 'not-a-date' })
    ).toEqual({ ok: false, code: 'TRACKING_IMPORT_STARTED_AT_INVALID' });
    expect(
      buildTrackingImportPayload({ ...valid, endedAtLocal: '' })
    ).toEqual({ ok: false, code: 'TRACKING_IMPORT_ENDED_AT_INVALID' });
  });

  it('rejects endedAt before startedAt', () => {
    const result = buildTrackingImportPayload({
      ...valid,
      startedAtLocal: '2026-10-15T11:00',
      endedAtLocal: '2026-10-15T10:00',
    });
    expect(result).toEqual({ ok: false, code: 'TRACKING_IMPORT_RANGE_INVALID' });
  });

  it('rejects pause longer than wall range', () => {
    const result = buildTrackingImportPayload({
      ...valid,
      startedAtLocal: '2026-10-15T09:00',
      endedAtLocal: '2026-10-15T09:05',
      accumulatedPausedMsRaw: String(10 * 60_000),
    });
    expect(result).toEqual({ ok: false, code: 'TRACKING_IMPORT_PAUSE_EXCEEDS_RANGE' });
  });

  it('rejects non-positive timeEntryId', () => {
    expect(
      buildTrackingImportPayload({ ...valid, timeEntryIdRaw: '0' })
    ).toEqual({ ok: false, code: 'TRACKING_IMPORT_TIME_ENTRY_ID_INVALID' });
    expect(
      buildTrackingImportPayload({ ...valid, timeEntryIdRaw: 'x' })
    ).toEqual({ ok: false, code: 'TRACKING_IMPORT_TIME_ENTRY_ID_INVALID' });
  });

  it('rejects negative accumulatedPausedMs', () => {
    expect(
      buildTrackingImportPayload({ ...valid, accumulatedPausedMsRaw: '-1' })
    ).toEqual({ ok: false, code: 'TRACKING_IMPORT_PAUSE_INVALID' });
  });
});
