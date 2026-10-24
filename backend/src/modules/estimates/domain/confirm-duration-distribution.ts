/**
 * EST-02 — distribuicao de confirmacao agregada por WorkActivity entre apontamentos.
 * Soma das parcelas = total da atividade (sem contagem dupla).
 */

import {
  applyDurationConfirmation,
  type ConfirmDurationResult,
} from './confirm-duration.js';

export const DISTRIBUTION_MIN_MINUTES = 15;
export const DISTRIBUTION_MAX_MINUTES = 8 * 60;

export type DistributionWeightEntry = {
  timeEntryId: number;
  weightMinutes: number;
};

export type DistributionShare = {
  timeEntryId: number;
  confirmedMinutes: number;
};

export type ActivityConfirmationEntryInput = {
  timeEntryId: number;
  durationMinutes: number;
  weightMinutes: number;
  estimatedDurationMinutes?: number | null;
  previousConfirmationId?: number | null;
  previousConfirmationVersion?: number | null;
};

export type ExplicitDistributionAllotment = {
  timeEntryId: number;
  confirmedMinutes: number;
};

export type ActivityConfirmationPlanItem = ConfirmDurationResult & {
  timeEntryId: number;
};

export type ActivityConfirmationPlan = {
  totalConfirmedMinutes: number;
  items: ActivityConfirmationPlanItem[];
};

/** Largest-remainder: soma das parcelas == total. */
export const buildProportionalDistribution = (
  totalConfirmedMinutes: number,
  entries: DistributionWeightEntry[]
): DistributionShare[] => {
  if (!Number.isFinite(totalConfirmedMinutes) || totalConfirmedMinutes < 0) {
    throw new Error('CONFIRMED_DURATION_INVALID');
  }
  if (entries.length === 0) throw new Error('DISTRIBUTION_EMPTY');

  const total = Math.round(totalConfirmedMinutes);
  const positiveWeights = entries.map((e) => ({
    timeEntryId: e.timeEntryId,
    weight: Math.max(0, Number(e.weightMinutes) || 0),
  }));
  const weightSum = positiveWeights.reduce((s, e) => s + e.weight, 0);
  const effective =
    weightSum > 0
      ? positiveWeights
      : positiveWeights.map((e) => ({ ...e, weight: 1 }));
  const denom = effective.reduce((s, e) => s + e.weight, 0);

  const raw = effective.map((e) => {
    const exact = (total * e.weight) / denom;
    const floor = Math.floor(exact);
    return {
      timeEntryId: e.timeEntryId,
      floor,
      frac: exact - floor,
    };
  });

  const assigned = raw.reduce((s, r) => s + r.floor, 0);
  let remainder = total - assigned;
  const byFrac = [...raw].sort((a, b) => b.frac - a.frac || a.timeEntryId - b.timeEntryId);
  const bonus = new Map<number, number>();
  for (let i = 0; i < byFrac.length && remainder > 0; i += 1) {
    bonus.set(byFrac[i]!.timeEntryId, (bonus.get(byFrac[i]!.timeEntryId) ?? 0) + 1);
    remainder -= 1;
  }

  return raw.map((r) => ({
    timeEntryId: r.timeEntryId,
    confirmedMinutes: r.floor + (bonus.get(r.timeEntryId) ?? 0),
  }));
};

const assertShareBounds = (minutes: number): void => {
  if (
    !Number.isInteger(minutes) ||
    minutes < DISTRIBUTION_MIN_MINUTES ||
    minutes > DISTRIBUTION_MAX_MINUTES
  ) {
    throw new Error('DISTRIBUTION_SHARE_INVALID');
  }
};

const resolveShares = (
  totalConfirmedMinutes: number,
  entries: ActivityConfirmationEntryInput[],
  explicit?: ExplicitDistributionAllotment[] | null
): DistributionShare[] => {
  if (entries.length === 0) throw new Error('DISTRIBUTION_EMPTY');
  const entryIds = new Set(entries.map((e) => e.timeEntryId));
  if (entryIds.size !== entries.length) throw new Error('DISTRIBUTION_ENTRY_MISMATCH');

  if (explicit != null) {
    if (explicit.length !== entries.length) throw new Error('DISTRIBUTION_ENTRY_MISMATCH');
    const seen = new Set<number>();
    for (const row of explicit) {
      if (!entryIds.has(row.timeEntryId) || seen.has(row.timeEntryId)) {
        throw new Error('DISTRIBUTION_ENTRY_MISMATCH');
      }
      seen.add(row.timeEntryId);
    }
    const sum = explicit.reduce((s, r) => s + Math.round(r.confirmedMinutes), 0);
    if (sum !== Math.round(totalConfirmedMinutes)) {
      throw new Error('DISTRIBUTION_SUM_MISMATCH');
    }
    return explicit.map((r) => ({
      timeEntryId: r.timeEntryId,
      confirmedMinutes: Math.round(r.confirmedMinutes),
    }));
  }

  return buildProportionalDistribution(
    totalConfirmedMinutes,
    entries.map((e) => ({ timeEntryId: e.timeEntryId, weightMinutes: e.weightMinutes }))
  );
};

export const planActivityConfirmationDistribution = (input: {
  totalConfirmedMinutes: number;
  entries: ActivityConfirmationEntryInput[];
  explicit?: ExplicitDistributionAllotment[] | null;
  actorUserId: number;
  justification?: string | null;
  now?: Date;
}): ActivityConfirmationPlan => {
  const total = Math.round(input.totalConfirmedMinutes);
  if (!Number.isFinite(input.totalConfirmedMinutes) || total < 0) {
    throw new Error('CONFIRMED_DURATION_INVALID');
  }

  const shares = resolveShares(total, input.entries, input.explicit);
  const shareSum = shares.reduce((s, r) => s + r.confirmedMinutes, 0);
  if (shareSum !== total) throw new Error('DISTRIBUTION_SUM_MISMATCH');

  const byId = new Map(input.entries.map((e) => [e.timeEntryId, e]));
  const items: ActivityConfirmationPlanItem[] = shares.map((share) => {
    assertShareBounds(share.confirmedMinutes);
    const entry = byId.get(share.timeEntryId);
    if (!entry) throw new Error('DISTRIBUTION_ENTRY_MISMATCH');
    const patch = applyDurationConfirmation({
      durationMinutes: entry.durationMinutes,
      estimatedDurationMinutes: entry.estimatedDurationMinutes,
      confirmedMinutes: share.confirmedMinutes,
      actorUserId: input.actorUserId,
      now: input.now,
      previousConfirmationId: entry.previousConfirmationId,
      previousConfirmationVersion: entry.previousConfirmationVersion,
      justification: input.justification,
    });
    return { timeEntryId: share.timeEntryId, ...patch };
  });

  return { totalConfirmedMinutes: total, items };
};
