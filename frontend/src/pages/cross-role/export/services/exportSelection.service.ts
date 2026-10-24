export type ExportRoleId = 1 | 2 | 3 | undefined;

export interface ExportSelectionInput {
  roleId: ExportRoleId;
  batchByClient: boolean;
  ownSheetsOnly: boolean;
  clientId: number;
  consultantId: number;
  userId?: number;
}

export interface ExportRequestParams {
  consultantId?: number;
  clientId?: number;
}

export const shouldDisableExportButton = (params: {
  roleId: ExportRoleId;
  batchByClient: boolean;
  clientId: number;
  selectedPeriodsCount: number;
}): boolean =>
  (params.roleId === 2 && params.batchByClient && params.clientId === 0) ||
  (params.roleId === 1 && params.selectedPeriodsCount === 0);

export const buildExportRequestParams = (input: ExportSelectionInput): ExportRequestParams => {
  const consultantId =
    input.roleId === 2 && input.ownSheetsOnly
      ? input.userId
      : input.roleId === 3 || (input.roleId === 2 && input.batchByClient)
        ? undefined
        : input.consultantId || undefined;

  return {
    consultantId,
    clientId: input.clientId || undefined,
  };
};
