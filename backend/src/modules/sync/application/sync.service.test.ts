import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn() }, client: { findUnique: vi.fn() },
  timeEntry: { findUnique: vi.fn() }, create: vi.fn(), update: vi.fn(), remove: vi.fn(),
}));
vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({ prisma: mocks }));
vi.mock('../../time-tracking/application/time-tracking.service.js', () => ({
  createTimeEntry: mocks.create,
  withTimeEntryRepository: () => ({ updateTimeEntry: mocks.update, deleteTimeEntry: mocks.remove }),
}));
import { push } from './sync.service.js';

const version = '2026-09-01T10:00:00.000Z';
const dto = { uuid: '00000000-0000-4000-8000-000000000001', userUuid: 'owner', clientUuid: 'client',
  date: '2026-09-01T00:00:00.000Z', activityDescription: 'Work', durationMinutes: 60,
  updatedAt: '2099-01-01T00:00:00.000Z', baseUpdatedAt: version };

describe('sync writes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.findUnique.mockResolvedValue({ id: 1, managerId: null });
    mocks.client.findUnique.mockResolvedValue({ id: 2, isActive: true, deletedAt: null });
    mocks.timeEntry.findUnique.mockResolvedValue(null);
  });

  it('never updates another owner using the callers userUuid', async () => {
    mocks.timeEntry.findUnique.mockResolvedValue({ id: 5, userId: 99, updatedAt: new Date(version) });
    const result = await push(1, 3, [dto]);
    expect(result.results[0].reason).toBe('SYNC_OWNER_MISMATCH');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('does not accept a client clock as authority for a stale version', async () => {
    mocks.timeEntry.findUnique.mockResolvedValue({ id: 5, userId: 1, updatedAt: new Date(version),
      date: new Date(dto.date), activityDescription: 'Existing', durationMinutes: 60, deletedAt: null });
    const result = await push(1, 3, [{ ...dto, baseUpdatedAt: null }]);
    expect(result.results[0].reason).toBe('SYNC_CONFLICT');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('passes new entries to the shared portal validation and preserves rejection', async () => {
    const { ForbiddenError } = await import('../../../app/errors/app-error.js');
    mocks.create.mockRejectedValue(new ForbiddenError('Time entry month is locked'));
    const result = await push(1, 3, [dto]);
    expect(result.results[0]).toMatchObject({ status: 'error', reason: 'Time entry month is locked' });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, uuid: dto.uuid }));
  });

  it('retries an identical write without creating a second entry', async () => {
    mocks.timeEntry.findUnique.mockResolvedValue({ id: 5, userId: 1, clientId: 2,
      date: new Date(dto.date), activityDescription: dto.activityDescription,
      durationMinutes: 60, deletedAt: null, updatedAt: new Date(version) });
    expect((await push(1, 3, [dto])).results[0]).toMatchObject({ status: 'applied', reason: 'UNCHANGED' });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('does not expose database errors to the caller', async () => {
    mocks.create.mockRejectedValue(new Error('database credentials internal details'));
    expect((await push(1, 3, [dto])).results[0].reason).toBe('SYNC_WRITE_FAILED');
  });
});
