import { describe, expect, it } from 'vitest';
import { exportLabel, requestLocale, withLocale } from './locale.js';
import { formatDatePtBr, getMonthLabel } from '../../modules/reports/http/export/formatters.js';
describe('request locale isolation', () => {
  it('keeps concurrent exports in their own language', async () => {
    const values = await Promise.all([
      withLocale('en-US,en;q=0.9', async () => {
        await Promise.resolve();
        return [exportLabel('Cliente'), getMonthLabel(1), formatDatePtBr(31, 1, 2026)];
      }),
      withLocale('pt-BR', async () => {
        await Promise.resolve();
        return [exportLabel('Cliente'), getMonthLabel(1), formatDatePtBr(31, 1, 2026)];
      }),
    ]);
    expect(values).toEqual([
      ['Client', 'January', '01/31/26'],
      ['Cliente', 'Janeiro', '31/01/26'],
    ]);
    expect(requestLocale()).toBe('pt-BR');
  });
});
