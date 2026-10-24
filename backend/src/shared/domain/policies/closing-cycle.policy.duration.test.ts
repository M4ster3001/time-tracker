import { describe, expect, it } from 'vitest';
import { computeCycleSummaryForUser } from './closing-cycle.policy.js';

describe('closing-cycle.policy DAT-01 eligibility', () => {
  it('ignora estimativa e medicao quando so durationMinutes/legado e elegivel', () => {
    const result = computeCycleSummaryForUser({
      year: 2026,
      month: 3,
      clients: [{ id: 10, name: 'Cliente', lockDay: 31 }],
      entries: [
        {
          clientId: 10,
          date: new Date('2026-03-10T00:00:00.000Z'),
          durationMinutes: 60,
          estimatedDurationMinutes: 200,
          actualTrackedDurationMinutes: 180,
          confirmedDurationMinutes: null,
        },
      ],
      allocations: [
        {
          clientId: 10,
          allocationType: 'MONTHLY',
          hoursPerDay: null,
          hoursPerMonth: 80,
          effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
          effectiveTo: null,
        },
      ],
    });

    expect(result.byClient[0].closedCycle.workedMinutes).toBe(60);
  });

  it('usa confirmado quando presente, sem somar estimativa', () => {
    const result = computeCycleSummaryForUser({
      year: 2026,
      month: 3,
      clients: [{ id: 10, name: 'Cliente', lockDay: 31 }],
      entries: [
        {
          clientId: 10,
          date: new Date('2026-03-10T00:00:00.000Z'),
          durationMinutes: 60,
          estimatedDurationMinutes: 200,
          confirmedDurationMinutes: 90,
          actualTrackedDurationMinutes: 180,
        },
      ],
      allocations: [
        {
          clientId: 10,
          allocationType: 'MONTHLY',
          hoursPerDay: null,
          hoursPerMonth: 80,
          effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
          effectiveTo: null,
        },
      ],
    });

    expect(result.byClient[0].closedCycle.workedMinutes).toBe(90);
  });
});
