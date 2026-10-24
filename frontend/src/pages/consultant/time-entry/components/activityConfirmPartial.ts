/**
 * EST-02 — mensagens de confirmação parcial (só apontamentos autorizados).
 */

export type ActivityConfirmPartialFields = {
  partial?: boolean;
  skippedTimeEntryIds?: number[];
};

export const normalizeSkippedTimeEntryIds = (
  ids: number[] | undefined | null
): number[] =>
  [...new Set((ids ?? []).filter((id) => Number.isSafeInteger(id) && id > 0))].sort(
    (a, b) => a - b
  );

export const isActivityConfirmPartial = (
  fields: ActivityConfirmPartialFields | null | undefined
): boolean =>
  Boolean(fields?.partial) && normalizeSkippedTimeEntryIds(fields?.skippedTimeEntryIds).length > 0;

export const formatSkippedEntryIdsLabel = (ids: number[]): string =>
  normalizeSkippedTimeEntryIds(ids)
    .map((id) => `#${id}`)
    .join(', ');
