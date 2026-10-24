/**
 * PRJ-01 — classificação em lote do legado “Sem projeto” (plano §5.2).
 * Prévia/conflitos; períodos fechados não são reclassificados por edição cadastral.
 */

import { isEntryLocked } from '../../../shared/domain/policies/time-entry-lock.policy.js';
import { assertProjectTransition, type ProjectState } from './project.rules.js';

export const MAX_LEGACY_CLASSIFY_BATCH = 100;

export type LegacyClassifyConflictReason =
  | 'ALREADY_HAS_PROJECT'
  | 'CLIENT_MISMATCH'
  | 'MONTH_LOCKED'
  | 'CLOSED_PERIOD'
  | 'PROJECT_NOT_USABLE'
  | 'ENTRY_NOT_FOUND'
  | 'ENTRY_DELETED';

export type LegacyClassifyDecision =
  | { status: 'eligible'; entryId: number }
  | { status: 'conflict'; entryId: number; reason: LegacyClassifyConflictReason };

export type LegacyClassifyEntrySnapshot = {
  id: number;
  clientId: number;
  projectId: number | null;
  date: Date;
  deletedAt: Date | null;
};

export type LegacyClassifyTargetProject = {
  id: number;
  clientId: number;
  state: ProjectState;
};

export const classifyLegacyEntryForProject = (input: {
  entry: LegacyClassifyEntrySnapshot | null;
  targetProject: LegacyClassifyTargetProject;
  lockDay: number | null;
  isClosedPeriod: boolean;
  now?: Date;
  requestedEntryId?: number;
}): LegacyClassifyDecision => {
  const entryId = input.entry?.id ?? input.requestedEntryId ?? 0;
  if (!input.entry) {
    return { status: 'conflict', entryId, reason: 'ENTRY_NOT_FOUND' };
  }
  if (input.entry.deletedAt != null) {
    return { status: 'conflict', entryId: input.entry.id, reason: 'ENTRY_DELETED' };
  }
  if (!assertProjectTransition(input.targetProject.state, 'canCreateTimeEntry')) {
    return { status: 'conflict', entryId: input.entry.id, reason: 'PROJECT_NOT_USABLE' };
  }
  if (input.entry.clientId !== input.targetProject.clientId) {
    return { status: 'conflict', entryId: input.entry.id, reason: 'CLIENT_MISMATCH' };
  }
  if (input.entry.projectId != null) {
    return { status: 'conflict', entryId: input.entry.id, reason: 'ALREADY_HAS_PROJECT' };
  }
  if (input.isClosedPeriod) {
    return { status: 'conflict', entryId: input.entry.id, reason: 'CLOSED_PERIOD' };
  }
  if (isEntryLocked(input.entry.date, input.lockDay, input.now ?? new Date())) {
    return { status: 'conflict', entryId: input.entry.id, reason: 'MONTH_LOCKED' };
  }
  return { status: 'eligible', entryId: input.entry.id };
};

export const partitionClassifyDecisions = (
  decisions: LegacyClassifyDecision[]
): {
  eligibleIds: number[];
  conflicts: Array<{ entryId: number; reason: LegacyClassifyConflictReason }>;
} => {
  if (decisions.length > MAX_LEGACY_CLASSIFY_BATCH) {
    throw new Error('LEGACY_CLASSIFY_BATCH_TOO_LARGE');
  }
  const eligibleIds: number[] = [];
  const conflicts: Array<{ entryId: number; reason: LegacyClassifyConflictReason }> = [];
  for (const decision of decisions) {
    if (decision.status === 'eligible') {
      eligibleIds.push(decision.entryId);
    } else {
      conflicts.push({ entryId: decision.entryId, reason: decision.reason });
    }
  }
  return { eligibleIds, conflicts };
};
