import { describe, expect, it } from 'vitest';
import { buildExportRequestParams, shouldDisableExportButton } from './exportSelection.service';

describe('exportSelection', () => {
  it('disables admin export without selected periods', () => {
    expect(
      shouldDisableExportButton({
        roleId: 1,
        batchByClient: false,
        clientId: 0,
        selectedPeriodsCount: 0,
      })
    ).toBe(true);
  });

  it('requires a client when manager exports batch by client', () => {
    expect(
      shouldDisableExportButton({
        roleId: 2,
        batchByClient: true,
        clientId: 0,
        selectedPeriodsCount: 1,
      })
    ).toBe(true);
  });

  it('uses current user when manager exports only own sheets', () => {
    expect(
      buildExportRequestParams({
        roleId: 2,
        batchByClient: false,
        ownSheetsOnly: true,
        clientId: 13,
        consultantId: 99,
        userId: 7,
      })
    ).toEqual({ consultantId: 7, clientId: 13 });
  });

  it('omits consultant for admin or batch exports', () => {
    expect(
      buildExportRequestParams({
        roleId: 1,
        batchByClient: false,
        ownSheetsOnly: false,
        clientId: 0,
        consultantId: 99,
      })
    ).toEqual({ consultantId: 99, clientId: undefined });

    expect(
      buildExportRequestParams({
        roleId: 2,
        batchByClient: true,
        ownSheetsOnly: false,
        clientId: 13,
        consultantId: 99,
      })
    ).toEqual({ consultantId: undefined, clientId: 13 });
  });
});
