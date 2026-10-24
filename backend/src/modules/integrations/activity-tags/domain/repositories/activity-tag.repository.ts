export type ActivityTagRecord = {
  id: number;
  name: string;
  aiGenerated: boolean;
  usageCount: number;
  lastUsedAt: Date;
};

export type QuickLogPatternRecord = {
  id: number;
  clientId: number | null;
  activityKey: string;
  activityLabel: string;
  durationMinutes: number;
  usageCount: number;
  lastUsedAt: Date;
};

export type ActivitySuggestionRecord = {
  name: string;
  suggestedDurationMinutes: number;
  usageCount: number;
  lastUsedAt: Date | null;
  source: 'client' | 'global' | 'default';
};

export interface ActivityTagRepository {
  listByUser(userId: number, limit: number): Promise<ActivityTagRecord[]>;
  listQuickLogPatterns(userId: number, clientId?: number): Promise<QuickLogPatternRecord[]>;
  upsertUsage(userId: number, name: string): Promise<void>;
  upsertQuickLogPattern(data: {
    userId: number;
    clientId: number | null;
    activityKey: string;
    activityLabel: string;
    durationMinutes: number;
  }): Promise<void>;
  markAiGenerated(userId: number, name: string): Promise<void>;
}
