import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listActivityTags, recordActivityTag } from './activity-tag.service.js';
import type { ActivityTagRepository } from '../domain/repositories/activity-tag.repository.js';

const createRepositoryMock = (): ActivityTagRepository => ({
  listByUser: vi.fn(),
  listQuickLogPatterns: vi.fn(),
  upsertUsage: vi.fn(),
  upsertQuickLogPattern: vi.fn(),
  markAiGenerated: vi.fn(),
});

describe('activity-tag.service', () => {
  let repository: ActivityTagRepository;

  beforeEach(() => {
    repository = createRepositoryMock();
  });

  it('returns default duration when there is no saved pattern', async () => {
    vi.mocked(repository.listByUser).mockResolvedValueOnce([
      {
        id: 1,
        name: 'Dev',
        aiGenerated: false,
        usageCount: 3,
        lastUsedAt: new Date('2026-04-08T10:00:00Z'),
      },
    ]);
    vi.mocked(repository.listQuickLogPatterns).mockResolvedValueOnce([]);

    const result = await listActivityTags(1, 5, undefined, { repository });

    expect(result).toEqual([
      expect.objectContaining({
        name: 'Dev',
        suggestedDurationMinutes: 30,
        source: 'default',
      }),
    ]);
  });

  it('prefers client-specific pattern over global history', async () => {
    vi.mocked(repository.listByUser).mockResolvedValueOnce([
      {
        id: 1,
        name: 'Ajuste API',
        aiGenerated: false,
        usageCount: 5,
        lastUsedAt: new Date('2026-04-08T10:00:00Z'),
      },
    ]);
    vi.mocked(repository.listQuickLogPatterns).mockResolvedValueOnce([
      {
        id: 10,
        clientId: null,
        activityKey: 'ajuste api',
        activityLabel: 'Ajuste API',
        durationMinutes: 30,
        usageCount: 8,
        lastUsedAt: new Date('2026-04-08T09:00:00Z'),
      },
      {
        id: 11,
        clientId: 7,
        activityKey: 'ajuste api',
        activityLabel: 'Ajuste API',
        durationMinutes: 45,
        usageCount: 3,
        lastUsedAt: new Date('2026-04-08T11:00:00Z'),
      },
    ]);

    const result = await listActivityTags(1, 5, { clientId: 7 }, { repository });

    expect(result[0]).toMatchObject({
      name: 'Ajuste API',
      suggestedDurationMinutes: 45,
      source: 'client',
    });
  });

  it('normalizes trivial variations and picks the most-used duration', async () => {
    vi.mocked(repository.listByUser).mockResolvedValueOnce([
      {
        id: 1,
        name: 'Ajuste API',
        aiGenerated: false,
        usageCount: 4,
        lastUsedAt: new Date('2026-04-08T10:00:00Z'),
      },
      {
        id: 2,
        name: ' ajuste api ',
        aiGenerated: false,
        usageCount: 2,
        lastUsedAt: new Date('2026-04-08T09:00:00Z'),
      },
    ]);
    vi.mocked(repository.listQuickLogPatterns).mockResolvedValueOnce([
      {
        id: 10,
        clientId: null,
        activityKey: 'ajuste api',
        activityLabel: 'AJUSTE   API',
        durationMinutes: 30,
        usageCount: 3,
        lastUsedAt: new Date('2026-04-08T08:00:00Z'),
      },
      {
        id: 11,
        clientId: null,
        activityKey: 'ajuste api',
        activityLabel: 'Ajuste API',
        durationMinutes: 45,
        usageCount: 6,
        lastUsedAt: new Date('2026-04-08T07:00:00Z'),
      },
    ]);

    const result = await listActivityTags(1, 5, undefined, { repository });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'Ajuste API',
      suggestedDurationMinutes: 45,
      source: 'global',
    });
  });

  it('ignores blank tag names', async () => {
    await recordActivityTag(1, '   ', undefined, { repository });

    expect(repository.upsertUsage).not.toHaveBeenCalled();
    expect(repository.upsertQuickLogPattern).not.toHaveBeenCalled();
  });

  it('records tag usage and quick-log pattern with normalized activity key', async () => {
    await recordActivityTag(1, 'Design', { clientId: 4, durationMinutes: 60 }, { repository });

    expect(repository.upsertUsage).toHaveBeenCalledWith(1, 'Design');
    expect(repository.upsertQuickLogPattern).toHaveBeenCalledWith({
      userId: 1,
      clientId: 4,
      activityKey: 'design',
      activityLabel: 'Design',
      durationMinutes: 60,
    });
    expect(repository.markAiGenerated).not.toHaveBeenCalled();
  });

  it('marks AI-generated tags without persisting duration patterns', async () => {
    await recordActivityTag(
      1,
      'Resumo IA',
      { aiGenerated: true, clientId: 3, durationMinutes: 15 },
      { repository }
    );

    expect(repository.upsertUsage).toHaveBeenCalledWith(1, 'Resumo IA');
    expect(repository.upsertQuickLogPattern).not.toHaveBeenCalled();
    expect(repository.markAiGenerated).toHaveBeenCalledWith(1, 'Resumo IA');
  });
});
