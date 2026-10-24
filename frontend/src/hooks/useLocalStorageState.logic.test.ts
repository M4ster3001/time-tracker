import { describe, expect, it } from 'vitest';
import { readStoredValue } from './useLocalStorageState.logic';

const isSimpleOrComplete = (value: string): value is 'simple' | 'complete' =>
  value === 'simple' || value === 'complete';

const fakeStorage = (values: Record<string, string>): Pick<Storage, 'getItem'> => ({
  getItem: (key: string) => (key in values ? values[key] : null),
});

describe('useLocalStorageState.logic', () => {
  it('retorna o default quando nada foi salvo', () => {
    expect(readStoredValue(fakeStorage({}), 'key', 'complete', isSimpleOrComplete)).toBe(
      'complete'
    );
  });

  it('retorna o valor salvo quando e valido', () => {
    expect(
      readStoredValue(fakeStorage({ key: 'simple' }), 'key', 'complete', isSimpleOrComplete)
    ).toBe('simple');
  });

  it('retorna o default quando o valor salvo e invalido', () => {
    expect(
      readStoredValue(fakeStorage({ key: 'garbage' }), 'key', 'complete', isSimpleOrComplete)
    ).toBe('complete');
  });
});
