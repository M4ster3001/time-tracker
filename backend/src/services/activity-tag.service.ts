import { activityTagRepository } from '../modules/integrations/activity-tags/index.js';
import {
  listActivityTags as listActivitySuggestions,
  recordActivityTag as recordActivitySuggestion,
} from '../modules/integrations/activity-tags/application/activity-tag.service.js';
import type { ActivitySuggestionRecord } from '../modules/integrations/activity-tags/domain/repositories/activity-tag.repository.js';

export const listActivityTags = async (
  userId: number,
  limit = 8,
  options?: { clientId?: number }
): Promise<ActivitySuggestionRecord[]> =>
  listActivitySuggestions(userId, limit, options, {
    repository: activityTagRepository,
  });

export const recordActivityTag = async (
  userId: number,
  name: string,
  options?: { aiGenerated?: boolean; clientId?: number | null; durationMinutes?: number | null }
): Promise<void> =>
  recordActivitySuggestion(userId, name, options, {
    repository: activityTagRepository,
  });
