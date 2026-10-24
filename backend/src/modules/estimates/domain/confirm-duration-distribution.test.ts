import { describe, expect, it } from 'vitest';
import {
  buildProportionalDistribution,
  planActivityConfirmationDistribution,
} from './confirm-duration-distribution.js';

describe('EST-02 multi-entry confirmation distribution', () => {
  it('rateia proporcionalmente com largest remainder e soma exata ao total', () => {
    const parts = buildProportionalDistribution(100, [
      { timeEntryId: 1, weightMinutes: 30 },
      { timeEntryId: 2, weightMinutes: 30 },
      { timeEntryId: 3, weightMinutes: 40 },
    ]);

    expect(parts.map((p) => p.confirmedMinutes)).toEqual([30, 30, 40]);
    expect(parts.reduce((s, p) => s + p.confirmedMinutes, 0)).toBe(100);
  });

  it('distribui resto pelos maiores residuos sem duplicar o total', () => {
    const parts = buildProportionalDistribution(100, [
      { timeEntryId: 1, weightMinutes: 1 },
      { timeEntryId: 2, weightMinutes: 1 },
      { timeEntryId: 3, weightMinutes: 1 },
    ]);

    expect(parts.reduce((s, p) => s + p.confirmedMinutes, 0)).toBe(100);
    expect(parts.every((p) => p.confirmedMinutes >= 33)).toBe(true);
    // 100/3 → 33+33+34
    expect(parts.map((p) => p.confirmedMinutes).sort((a, b) => a - b)).toEqual([33, 33, 34]);
  });

  it('aceita distribuicao explicita cuja soma e o total da atividade', () => {
    const plan = planActivityConfirmationDistribution({
      totalConfirmedMinutes: 180,
      actorUserId: 7,
      now: new Date('2026-10-15T12:00:00.000Z'),
      entries: [
        {
          timeEntryId: 1,
          durationMinutes: 90,
          weightMinutes: 90,
          estimatedDurationMinutes: 100,
          previousConfirmationId: null,
          previousConfirmationVersion: null,
        },
        {
          timeEntryId: 2,
          durationMinutes: 60,
          weightMinutes: 60,
          estimatedDurationMinutes: 80,
          previousConfirmationId: 9,
          previousConfirmationVersion: 1,
        },
      ],
      explicit: [
        { timeEntryId: 1, confirmedMinutes: 105 },
        { timeEntryId: 2, confirmedMinutes: 75 },
      ],
      justification: 'rateio revisado',
    });

    expect(plan.totalConfirmedMinutes).toBe(180);
    expect(plan.items).toHaveLength(2);
    expect(plan.items[0]).toMatchObject({
      timeEntryId: 1,
      confirmedDurationMinutes: 105,
      estimatedDurationMinutes: 100,
      confirmationVersion: 1,
      justification: 'rateio revisado',
    });
    expect(plan.items[1]).toMatchObject({
      timeEntryId: 2,
      confirmedDurationMinutes: 75,
      confirmationVersion: 2,
      previousConfirmationId: 9,
    });
    expect(plan.items.reduce((s, i) => s + i.confirmedDurationMinutes, 0)).toBe(180);
  });

  it('rejeita distribuicao explicita incompleta ou com soma diferente do total', () => {
    const baseEntries = [
      {
        timeEntryId: 1,
        durationMinutes: 60,
        weightMinutes: 60,
        estimatedDurationMinutes: null,
        previousConfirmationId: null,
        previousConfirmationVersion: null,
      },
      {
        timeEntryId: 2,
        durationMinutes: 60,
        weightMinutes: 60,
        estimatedDurationMinutes: null,
        previousConfirmationId: null,
        previousConfirmationVersion: null,
      },
    ];

    expect(() =>
      planActivityConfirmationDistribution({
        totalConfirmedMinutes: 120,
        actorUserId: 1,
        entries: baseEntries,
        explicit: [{ timeEntryId: 1, confirmedMinutes: 120 }],
      })
    ).toThrow(/DISTRIBUTION_ENTRY_MISMATCH/);

    expect(() =>
      planActivityConfirmationDistribution({
        totalConfirmedMinutes: 120,
        actorUserId: 1,
        entries: baseEntries,
        explicit: [
          { timeEntryId: 1, confirmedMinutes: 50 },
          { timeEntryId: 2, confirmedMinutes: 50 },
        ],
      })
    ).toThrow(/DISTRIBUTION_SUM_MISMATCH/);
  });

  it('rejeita parcela fora do intervalo de apontamento (15–480)', () => {
    expect(() =>
      planActivityConfirmationDistribution({
        totalConfirmedMinutes: 20,
        actorUserId: 1,
        entries: [
          {
            timeEntryId: 1,
            durationMinutes: 60,
            weightMinutes: 60,
            estimatedDurationMinutes: null,
            previousConfirmationId: null,
            previousConfirmationVersion: null,
          },
          {
            timeEntryId: 2,
            durationMinutes: 60,
            weightMinutes: 60,
            estimatedDurationMinutes: null,
            previousConfirmationId: null,
            previousConfirmationVersion: null,
          },
        ],
      })
    ).toThrow(/DISTRIBUTION_SHARE_INVALID/);
  });

  it('sem explicito, rateia por peso e preserva estimativa por apontamento', () => {
    const plan = planActivityConfirmationDistribution({
      totalConfirmedMinutes: 120,
      actorUserId: 3,
      entries: [
        {
          timeEntryId: 10,
          durationMinutes: 90,
          weightMinutes: 90,
          estimatedDurationMinutes: 100,
          previousConfirmationId: null,
          previousConfirmationVersion: null,
        },
        {
          timeEntryId: 11,
          durationMinutes: 30,
          weightMinutes: 30,
          estimatedDurationMinutes: 40,
          previousConfirmationId: null,
          previousConfirmationVersion: null,
        },
      ],
    });

    expect(plan.items.map((i) => i.confirmedDurationMinutes)).toEqual([90, 30]);
    expect(plan.items[0]!.estimatedDurationMinutes).toBe(100);
    expect(plan.items[1]!.estimatedDurationMinutes).toBe(40);
  });
});
