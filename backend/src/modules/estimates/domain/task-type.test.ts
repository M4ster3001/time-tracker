import { describe, expect, it } from 'vitest';
import {
  buildTaskTypeCreateDraft,
  buildTaskTypeUpdateDraft,
  normalizeTaskTypeCode,
} from './task-type.js';

describe('EST-01 task type catalog drafts', () => {
  it('normaliza código para maiúsculas sem espaços', () => {
    expect(normalizeTaskTypeCode('  implementation ')).toBe('IMPLEMENTATION');
  });

  it('rejeita código vazio ou inválido', () => {
    expect(() => buildTaskTypeCreateDraft({ code: '', namePt: 'A', nameEn: 'A' })).toThrow(
      'TASK_TYPE_CODE_INVALID'
    );
    expect(() =>
      buildTaskTypeCreateDraft({ code: 'bad code', namePt: 'A', nameEn: 'A' })
    ).toThrow('TASK_TYPE_CODE_INVALID');
  });

  it('exige nomes PT e EN', () => {
    expect(() =>
      buildTaskTypeCreateDraft({ code: 'IMPL', namePt: '  ', nameEn: 'Impl' })
    ).toThrow('TASK_TYPE_NAME_PT_REQUIRED');
    expect(() =>
      buildTaskTypeCreateDraft({ code: 'IMPL', namePt: 'Impl', nameEn: '' })
    ).toThrow('TASK_TYPE_NAME_EN_REQUIRED');
  });

  it('aceita rascunho de criação com parâmetros iniciais opcionais', () => {
    const draft = buildTaskTypeCreateDraft({
      code: 'tests',
      namePt: 'Testes',
      nameEn: 'Tests',
      description: ' QA ',
      baseMinutes: 60,
      factor: 1.25,
    });
    expect(draft).toEqual({
      code: 'TESTS',
      namePt: 'Testes',
      nameEn: 'Tests',
      description: 'QA',
      isActive: true,
      initialParameters: {
        baseMinutes: 60,
        factor: 1.25,
        roundingMode: 'NEAREST_MINUTE',
      },
    });
  });

  it('rejeita base/fator inválidos quando fornecidos', () => {
    expect(() =>
      buildTaskTypeCreateDraft({
        code: 'IMPL',
        namePt: 'Impl',
        nameEn: 'Impl',
        baseMinutes: 0,
        factor: 1,
      })
    ).toThrow('ESTIMATE_BASE_INVALID');
    expect(() =>
      buildTaskTypeCreateDraft({
        code: 'IMPL',
        namePt: 'Impl',
        nameEn: 'Impl',
        baseMinutes: 30,
        factor: -1,
      })
    ).toThrow('ESTIMATE_FACTOR_INVALID');
  });

  it('atualização preserva campos omitidos e valida nomes quando presentes', () => {
    expect(buildTaskTypeUpdateDraft({ namePt: ' Novo ' })).toEqual({
      namePt: 'Novo',
      nameEn: undefined,
      description: undefined,
      isActive: undefined,
    });
    expect(() => buildTaskTypeUpdateDraft({ nameEn: '  ' })).toThrow(
      'TASK_TYPE_NAME_EN_REQUIRED'
    );
  });
});
