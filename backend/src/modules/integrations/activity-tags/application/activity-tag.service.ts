import type {
  ActivitySuggestionRecord,
  ActivityTagRepository,
  QuickLogPatternRecord,
} from '../domain/repositories/activity-tag.repository.js';

const DEFAULT_SUGGESTED_DURATION = 30;

const normalizeActivityKey = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const comparePatternPriority = (
  left: QuickLogPatternRecord,
  right: QuickLogPatternRecord
): number => {
  if (left.usageCount !== right.usageCount) {
    return right.usageCount - left.usageCount;
  }

  return right.lastUsedAt.getTime() - left.lastUsedAt.getTime();
};

const buildSuggestionMap = (patterns: QuickLogPatternRecord[], filterClientSpecific: boolean) => {
  const map = new Map<string, QuickLogPatternRecord>();

  for (const pattern of patterns) {
    if (filterClientSpecific && pattern.clientId === null) continue;
    if (!filterClientSpecific && pattern.clientId !== null) continue;

    const current = map.get(pattern.activityKey);
    if (!current || comparePatternPriority(current, pattern) > 0) {
      map.set(pattern.activityKey, pattern);
    }
  }

  return map;
};

export const listActivityTags = async (
  userId: number,
  limit = 8,
  options: { clientId?: number } | undefined,
  deps: { repository: ActivityTagRepository }
): Promise<ActivitySuggestionRecord[]> => {
  const safeLimit = Math.max(limit, 1);
  const [tags, patterns] = await Promise.all([
    deps.repository.listByUser(userId, safeLimit * 4),
    deps.repository.listQuickLogPatterns(userId, options?.clientId),
  ]);

  const clientPatterns = buildSuggestionMap(patterns, true);
  const globalPatterns = buildSuggestionMap(patterns, false);
  const suggestions: ActivitySuggestionRecord[] = [];
  const seen = new Set<string>();

  const pushSuggestion = (
    name: string,
    fallbackUsageCount: number,
    fallbackLastUsedAt: Date | null
  ) => {
    const activityKey = normalizeActivityKey(name);
    if (!activityKey || seen.has(activityKey)) return;

    const clientPattern = clientPatterns.get(activityKey);
    const globalPattern = globalPatterns.get(activityKey);
    const selectedPattern = clientPattern ?? globalPattern;

    suggestions.push({
      name: selectedPattern?.activityLabel ?? name.trim(),
      suggestedDurationMinutes: selectedPattern?.durationMinutes ?? DEFAULT_SUGGESTED_DURATION,
      usageCount: selectedPattern?.usageCount ?? fallbackUsageCount,
      lastUsedAt: selectedPattern?.lastUsedAt ?? fallbackLastUsedAt,
      source: clientPattern ? 'client' : globalPattern ? 'global' : 'default',
    });
    seen.add(activityKey);
  };

  for (const tag of tags) {
    pushSuggestion(tag.name, tag.usageCount, tag.lastUsedAt);
  }

  for (const pattern of [...clientPatterns.values(), ...globalPatterns.values()]) {
    pushSuggestion(pattern.activityLabel, pattern.usageCount, pattern.lastUsedAt);
  }

  return suggestions.slice(0, safeLimit);
};

export const recordActivityTag = async (
  userId: number,
  name: string,
  options:
    | { aiGenerated?: boolean; clientId?: number | null; durationMinutes?: number | null }
    | undefined,
  deps: { repository: ActivityTagRepository }
): Promise<void> => {
  const trimmed = name.trim();
  if (!trimmed) return;

  await deps.repository.upsertUsage(userId, trimmed);
  if (
    options?.aiGenerated !== true &&
    typeof options?.durationMinutes === 'number' &&
    options.durationMinutes > 0
  ) {
    await deps.repository.upsertQuickLogPattern({
      userId,
      clientId: options.clientId ?? null,
      activityKey: normalizeActivityKey(trimmed),
      activityLabel: trimmed,
      durationMinutes: options.durationMinutes,
    });
  }
  if (options?.aiGenerated === true) {
    await deps.repository.markAiGenerated(userId, trimmed);
  }
};
