import { exportLabel } from '../../../../shared/domain/locale.js';
import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { getHourPoolReport } from '../../application/hour-pool-report.service.js';
import { toAppError, getErrorMessage, resolveErrorStatus } from '../../../../app/errors/app-error.js';
import { logger } from '../../../../shared/infrastructure/logger/logger.js';
import { sanitizeFileName } from './formatters.js';
import { normalizeBuffer } from './zip.factory.js';
import type { HourPoolExportQuery } from '../schemas.js';

const monthLabel = (year: number, month: number): string => `${year}-${String(month).padStart(2, '0')}`;

/**
 * GET /api/admin/reports/hour-pool/export
 * XLSX do bolsao de horas de UM cliente (consultores x horas x valor), pronto pra mandar pro cliente.
 */
export const hourPoolExportController = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query as unknown as HourPoolExportQuery;
    const lineItems = await getHourPoolReport({
      year: query.year,
      month: query.month,
      clientId: query.clientId,
    });

    const workbook = new ExcelJS.Workbook();
    const clientName = lineItems[0]?.clientName ?? `Cliente ${query.clientId}`;
    const clientCode = lineItems[0]?.clientCode || String(query.clientId);
    const sheet = workbook.addWorksheet(exportLabel("Bolsao de Horas"));

    sheet.columns = [
      { header: exportLabel("Consultor"), key: 'consultor', width: 32 },
      { header: exportLabel("Horas Trabalhadas"), key: 'workedHours', width: 18 },
      { header: exportLabel("Horas Contratadas"), key: 'allocatedHours', width: 18 },
      { header: exportLabel("Horas Extras"), key: 'overtimeHours', width: 16 },
      { header: exportLabel("Horas Faturaveis"), key: 'billableHours', width: 18 },
      { header: exportLabel("Valor/Hora (R$)"), key: 'hourlyRate', width: 16 },
      { header: exportLabel("Total (R$)"), key: 'total', width: 16 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    let totalAmount = 0;
    lineItems.forEach((item) => {
      totalAmount += item.billableAmount ?? 0;
      sheet.addRow({
        consultor: item.consultantName,
        workedHours: item.workedHours,
        allocatedHours: item.allocatedHours,
        overtimeHours: item.overtimeHours,
        billableHours: item.billableHours,
        hourlyRate: item.hourlyRate,
        total: item.billableAmount,
      });
    });

    const totalRow = sheet.addRow({ consultor: 'Total', total: totalAmount });
    totalRow.font = { bold: true };

    const buffer = normalizeBuffer(await workbook.xlsx.writeBuffer());
    const fileName = `bolsao-horas-${sanitizeFileName(clientCode)}-${monthLabel(query.year, query.month)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    logger.info({ clientId: query.clientId, clientName }, 'Bolsao de horas exportado');
    res.status(200).send(buffer);
  } catch (error) {
    logger.error({ err: error }, 'Error exporting hour pool report');
    const appError = toAppError(error);
    res
      .status(resolveErrorStatus(appError))
      .json({ success: false, error: getErrorMessage(appError) });
  }
};
