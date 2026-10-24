import { describe, expect, it, vi } from 'vitest';
import {
  computeCycleSummariesForUsers,
  computeCycleSummaryForUser,
} from './closing-cycle.service.js';
import type { ClosingCycleRepository } from '../domain/repositories/closing-cycle.repository.js';

const buildRepository = (overrides: Partial<ClosingCycleRepository> = {}): ClosingCycleRepository => ({
  findClientIdsLinkedToUser: vi.fn().mockResolvedValue([]),
  findClientIdsLinkedToUsers: vi.fn().mockResolvedValue([]),
  findClientIdsWithTimeEntriesInRange: vi.fn().mockResolvedValue([]),
  findClientIdsWithTimeEntriesInRangeForUsers: vi.fn().mockResolvedValue([]),
  findClientsByIds: vi.fn().mockResolvedValue([]),
  findTimeEntriesInRange: vi.fn().mockResolvedValue([]),
  findTimeEntriesInRangeForUsers: vi.fn().mockResolvedValue([]),
  findAllocationHistoryInRange: vi.fn().mockResolvedValue([]),
  findAllocationHistoryInRangeForUsers: vi.fn().mockResolvedValue([]),
  findCurrentAllocationSnapshot: vi.fn().mockResolvedValue([]),
  findCurrentAllocationSnapshotsForUsers: vi.fn().mockResolvedValue([]),
  ...overrides,
});

describe('closing-cycle.service', () => {
  it('retorna resumo vazio quando o usuario nao tem nenhum cliente vinculado', async () => {
    const repository = buildRepository();

    const result = await computeCycleSummaryForUser(
      { userId: 1, year: 2026, month: 3 },
      repository
    );

    expect(result.byClient).toEqual([]);
    expect(result.totals.closedCycle.workedMinutes).toBe(0);
  });

  it('retorna resumo vazio quando o clientId pedido nao esta entre os permitidos', async () => {
    const repository = buildRepository({
      findClientIdsLinkedToUser: vi.fn().mockResolvedValue([5]),
    });

    const result = await computeCycleSummaryForUser(
      { userId: 1, year: 2026, month: 3, clientId: 999 },
      repository
    );

    expect(result.byClient).toEqual([]);
  });

  it('usa o historico de alocacao quando disponivel, sem cair no fallback', async () => {
    const findCurrentAllocationSnapshot = vi.fn().mockResolvedValue([]);
    const repository = buildRepository({
      findClientIdsLinkedToUser: vi.fn().mockResolvedValue([10]),
      findClientsByIds: vi.fn().mockResolvedValue([{ id: 10, name: 'Cliente A', lockDay: null }]),
      findTimeEntriesInRange: vi.fn().mockResolvedValue([
        { clientId: 10, durationMinutes: 480, date: new Date('2026-03-10T00:00:00.000Z') },
      ]),
      findAllocationHistoryInRange: vi.fn().mockResolvedValue([
        {
          userId: 1,
          clientId: 10,
          allocationType: 'MONTHLY',
          hoursPerDay: null,
          hoursPerMonth: 80,
          effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
          effectiveTo: null,
        },
      ]),
      findCurrentAllocationSnapshot,
    });

    const result = await computeCycleSummaryForUser(
      { userId: 1, year: 2026, month: 3 },
      repository
    );

    expect(result.byClient).toHaveLength(1);
    expect(findCurrentAllocationSnapshot).not.toHaveBeenCalled();
  });

  it('cai no snapshot atual quando nao ha historico de alocacao', async () => {
    const repository = buildRepository({
      findClientIdsLinkedToUser: vi.fn().mockResolvedValue([10]),
      findClientsByIds: vi.fn().mockResolvedValue([{ id: 10, name: 'Cliente A', lockDay: null }]),
      findTimeEntriesInRange: vi.fn().mockResolvedValue([]),
      findAllocationHistoryInRange: vi.fn().mockResolvedValue([]),
      findCurrentAllocationSnapshot: vi.fn().mockResolvedValue([
        {
          userId: 1,
          clientId: 10,
          allocationType: 'MONTHLY',
          hoursPerDay: null,
          hoursPerMonth: 80,
        },
      ]),
    });

    const result = await computeCycleSummaryForUser(
      { userId: 1, year: 2026, month: 3 },
      repository
    );

    expect(result.byClient).toHaveLength(1);
    expect(repository.findCurrentAllocationSnapshot).toHaveBeenCalledWith(1, [10]);
  });

  it('batches cycle summaries for many users with one query per resource kind', async () => {
    const findClientIdsLinkedToUsers = vi.fn().mockResolvedValue([
      { userId: 1, clientId: 10 },
      { userId: 2, clientId: 20 },
      { userId: 3, clientId: 10 },
    ]);
    const findClientIdsWithTimeEntriesInRangeForUsers = vi.fn().mockResolvedValue([]);
    const findClientsByIds = vi.fn().mockResolvedValue([
      { id: 10, name: 'Cliente A', lockDay: null },
      { id: 20, name: 'Cliente B', lockDay: null },
    ]);
    const findTimeEntriesInRangeForUsers = vi.fn().mockResolvedValue([
      {
        userId: 1,
        clientId: 10,
        durationMinutes: 60,
        date: new Date('2026-03-10T00:00:00.000Z'),
      },
      {
        userId: 2,
        clientId: 20,
        durationMinutes: 120,
        date: new Date('2026-03-11T00:00:00.000Z'),
      },
    ]);
    const findAllocationHistoryInRangeForUsers = vi.fn().mockResolvedValue([
      {
        userId: 1,
        clientId: 10,
        allocationType: 'MONTHLY',
        hoursPerDay: null,
        hoursPerMonth: 80,
        effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
        effectiveTo: null,
      },
      {
        userId: 2,
        clientId: 20,
        allocationType: 'MONTHLY',
        hoursPerDay: null,
        hoursPerMonth: 80,
        effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
        effectiveTo: null,
      },
      {
        userId: 3,
        clientId: 10,
        allocationType: 'MONTHLY',
        hoursPerDay: null,
        hoursPerMonth: 80,
        effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    ]);
    const findCurrentAllocationSnapshotsForUsers = vi.fn().mockResolvedValue([]);
    const findClientIdsLinkedToUser = vi.fn();
    const findTimeEntriesInRange = vi.fn();

    const repository = buildRepository({
      findClientIdsLinkedToUsers,
      findClientIdsWithTimeEntriesInRangeForUsers,
      findClientsByIds,
      findTimeEntriesInRangeForUsers,
      findAllocationHistoryInRangeForUsers,
      findCurrentAllocationSnapshotsForUsers,
      findClientIdsLinkedToUser,
      findTimeEntriesInRange,
    });

    const byUser = await computeCycleSummariesForUsers(
      { userIds: [1, 2, 3], year: 2026, month: 3 },
      repository
    );

    expect(findClientIdsLinkedToUsers).toHaveBeenCalledTimes(1);
    expect(findClientIdsLinkedToUsers).toHaveBeenCalledWith([1, 2, 3]);
    expect(findClientIdsWithTimeEntriesInRangeForUsers).toHaveBeenCalledTimes(1);
    expect(findClientsByIds).toHaveBeenCalledTimes(1);
    expect(findTimeEntriesInRangeForUsers).toHaveBeenCalledTimes(1);
    expect(findAllocationHistoryInRangeForUsers).toHaveBeenCalledTimes(1);
    expect(findClientIdsLinkedToUser).not.toHaveBeenCalled();
    expect(findTimeEntriesInRange).not.toHaveBeenCalled();
    expect(findCurrentAllocationSnapshotsForUsers).not.toHaveBeenCalled();

    expect(byUser.get(1)?.totals.closedCycle.workedMinutes).toBe(60);
    expect(byUser.get(2)?.totals.closedCycle.workedMinutes).toBe(120);
    expect(byUser.get(3)?.totals.closedCycle.workedMinutes).toBe(0);
  });

  it('returns empty summaries map without querying when userIds is empty', async () => {
    const findClientIdsLinkedToUsers = vi.fn();
    const repository = buildRepository({ findClientIdsLinkedToUsers });

    const byUser = await computeCycleSummariesForUsers(
      { userIds: [], year: 2026, month: 3 },
      repository
    );

    expect(byUser.size).toBe(0);
    expect(findClientIdsLinkedToUsers).not.toHaveBeenCalled();
  });
});
