import { describe, expect, it } from 'vitest';
import {
  buildDraftPayload,
  computeMonthlyTargetMinutes,
  draftFromRow,
  draftsFromRows,
  emptyDraft,
} from './useAllocationEditor.logic';
import type { AllocationRow } from './allocation.types';

describe('useAllocationEditor.logic', () => {
  describe('draftFromRow', () => {
    it('retorna draft vazio quando a linha nao tem alocacao', () => {
      const row: AllocationRow = { clientId: 1, clientName: 'Cliente A', allocation: null };
      expect(draftFromRow(row)).toEqual(emptyDraft());
    });

    it('preenche horas a partir de hoursPerDay quando o tipo e DAILY', () => {
      const row: AllocationRow = {
        clientId: 1,
        clientName: 'Cliente A',
        allocation: {
          allocationType: 'DAILY',
          hoursPerDay: 4,
          hoursPerMonth: null,
          hourlyRate: 150,
        },
      };
      expect(draftFromRow(row)).toEqual({ allocationType: 'DAILY', hours: '4', hourlyRate: '150' });
    });

    it('preenche horas a partir de hoursPerMonth quando o tipo e MONTHLY', () => {
      const row: AllocationRow = {
        clientId: 1,
        clientName: 'Cliente A',
        allocation: {
          allocationType: 'MONTHLY',
          hoursPerDay: null,
          hoursPerMonth: 80,
          hourlyRate: null,
        },
      };
      expect(draftFromRow(row)).toEqual({ allocationType: 'MONTHLY', hours: '80', hourlyRate: '' });
    });
  });

  it('draftsFromRows indexa os drafts por clientId', () => {
    const rows: AllocationRow[] = [
      { clientId: 1, clientName: 'A', allocation: null },
      {
        clientId: 2,
        clientName: 'B',
        allocation: {
          allocationType: 'DAILY',
          hoursPerDay: 2,
          hoursPerMonth: null,
          hourlyRate: null,
        },
      },
    ];
    expect(draftsFromRows(rows)).toEqual({
      1: emptyDraft(),
      2: { allocationType: 'DAILY', hours: '2', hourlyRate: '' },
    });
  });

  describe('buildDraftPayload', () => {
    it('retorna null quando nao ha draft', () => {
      expect(buildDraftPayload(undefined)).toBeNull();
    });

    it('retorna null quando horas estao vazias', () => {
      expect(buildDraftPayload({ allocationType: 'DAILY', hours: '', hourlyRate: '' })).toBeNull();
    });

    it('retorna null quando horas nao sao um numero valido', () => {
      expect(
        buildDraftPayload({ allocationType: 'DAILY', hours: 'abc', hourlyRate: '' })
      ).toBeNull();
    });

    it('aceita zero como valor valido de horas (bug corrigido: 0 nao e falsy aqui)', () => {
      expect(buildDraftPayload({ allocationType: 'DAILY', hours: '0', hourlyRate: '' })).toEqual({
        allocationType: 'DAILY',
        hoursPerDay: 0,
        hoursPerMonth: null,
        hourlyRate: null,
      });
    });

    it('retorna null quando hourlyRate informado nao e um numero valido', () => {
      expect(
        buildDraftPayload({ allocationType: 'DAILY', hours: '4', hourlyRate: 'abc' })
      ).toBeNull();
    });

    it('monta o payload MONTHLY com hourlyRate numerico', () => {
      expect(
        buildDraftPayload({ allocationType: 'MONTHLY', hours: '80', hourlyRate: '150.5' })
      ).toEqual({
        allocationType: 'MONTHLY',
        hoursPerDay: null,
        hoursPerMonth: 80,
        hourlyRate: 150.5,
      });
    });
  });

  describe('computeMonthlyTargetMinutes', () => {
    it('retorna 0 quando as horas nao sao positivas', () => {
      expect(
        computeMonthlyTargetMinutes({ allocationType: 'DAILY', hours: '0', hourlyRate: '' }, 22)
      ).toBe(0);
      expect(
        computeMonthlyTargetMinutes({ allocationType: 'DAILY', hours: '', hourlyRate: '' }, 22)
      ).toBe(0);
    });

    it('multiplica pelos dias uteis quando DAILY', () => {
      expect(
        computeMonthlyTargetMinutes({ allocationType: 'DAILY', hours: '4', hourlyRate: '' }, 22)
      ).toBe(4 * 22 * 60);
    });

    it('usa direto as horas quando MONTHLY', () => {
      expect(
        computeMonthlyTargetMinutes({ allocationType: 'MONTHLY', hours: '80', hourlyRate: '' }, 22)
      ).toBe(80 * 60);
    });
  });
});
