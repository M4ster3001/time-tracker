import { describe, expect, it } from 'vitest';
import { buildParameterSetDeactivateDraft } from './parameter-set-deactivate.js';

describe('buildParameterSetDeactivateDraft', () => {
  it('marks an active CLIENT/PROJECT/GLOBAL set inactive without deleting history', () => {
    expect(
      buildParameterSetDeactivateDraft({ id: 9, isActive: true, scope: 'CLIENT' })
    ).toEqual({ id: 9, isActive: false });
    expect(
      buildParameterSetDeactivateDraft({ id: 3, isActive: true, scope: 'PROJECT' })
    ).toEqual({ id: 3, isActive: false });
  });

  it('rejects already inactive sets', () => {
    expect(() =>
      buildParameterSetDeactivateDraft({ id: 1, isActive: false, scope: 'CLIENT' })
    ).toThrow(/PARAMETER_SET_ALREADY_INACTIVE/);
  });
});
