import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { listActivityTagsController } from './controller.js';
import * as activityTagService from '../application/activity-tag.service.js';

vi.mock('../application/activity-tag.service.js', () => ({
  listActivityTags: vi.fn(),
}));

const createResponse = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('activity-tags controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns structured suggestions and forwards optional clientId', async () => {
    const req = {
      query: { limit: '8', clientId: '12' },
      user: { userId: 7, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    vi.mocked(activityTagService.listActivityTags).mockResolvedValueOnce([
      {
        name: 'Ajuste API',
        suggestedDurationMinutes: 45,
        usageCount: 4,
        lastUsedAt: new Date('2026-04-08T10:00:00Z'),
        source: 'client',
      },
    ]);

    await listActivityTagsController(req, res, next);

    expect(activityTagService.listActivityTags).toHaveBeenCalledWith(
      7,
      8,
      { clientId: 12 },
      expect.any(Object)
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [
          expect.objectContaining({
            name: 'Ajuste API',
            suggestedDurationMinutes: 45,
            source: 'client',
          }),
        ],
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards invalid clientId to the error pipeline', async () => {
    const req = {
      query: { clientId: 'abc' },
      user: { userId: 7, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await listActivityTagsController(req, res, next);

    expect(activityTagService.listActivityTags).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid clientId',
      })
    );
  });
});
