import { describe, expect, it } from 'vitest';
import { clampPage, paginate } from './usePagination.logic';

describe('usePagination.logic', () => {
  describe('paginate', () => {
    it('retorna a fatia correta para a pagina pedida', () => {
      const items = [1, 2, 3, 4, 5, 6, 7];
      expect(paginate(items, 1, 3)).toEqual([1, 2, 3]);
      expect(paginate(items, 2, 3)).toEqual([4, 5, 6]);
      expect(paginate(items, 3, 3)).toEqual([7]);
    });

    it('retorna vazio quando a pagina esta alem do total', () => {
      expect(paginate([1, 2, 3], 5, 10)).toEqual([]);
    });
  });

  describe('clampPage', () => {
    it('mantem a pagina quando ainda e valida', () => {
      expect(clampPage(2, 25, 10)).toBe(2);
    });

    it('reduz para a ultima pagina valida quando a lista encolheu', () => {
      expect(clampPage(5, 12, 10)).toBe(2);
    });

    it('nunca fica abaixo de 1', () => {
      expect(clampPage(0, 0, 10)).toBe(1);
      expect(clampPage(-3, 5, 10)).toBe(1);
    });
  });
});
