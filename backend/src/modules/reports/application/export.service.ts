import type { ExportEntryRow } from '../domain/repositories/report.repository.js';
import { reportRepository } from '../infrastructure/repositories/prisma-report.repository.js';

export const getExportData = async (filters: {
  month: number;
  year: number;
  consultantId?: number;
  clientId?: number;
  userIds?: number[];
}): Promise<ExportEntryRow[]> => {
  return reportRepository.getExportData(filters);
};
