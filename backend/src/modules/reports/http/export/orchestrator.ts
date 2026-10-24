import { exportLabel } from '../../../../shared/domain/locale.js';
import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { getExportData } from '../../application/export.service.js';
import {
  resolveErrorStatus,
  getErrorMessage,
  BadRequestError,
} from '../../../../app/errors/app-error.js';
import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import { getWorkingDaysInMonth } from '../../../../shared/domain/date.js';
import { computeOvertimeByAllocation } from '../../../time-tracking/domain/policies/overtime-rules.policy.js';
import { computeCycleSummaryForUser } from '../../../closing-cycle/application/closing-cycle.service.js';
import type {
  ClientCycleSummary,
  CycleSummaryResult,
} from '../../../../shared/domain/policies/closing-cycle.policy.js';
import {
  formatDatePtBr,
  getMonthLabel,
  getWeekdayLabel,
  monthFolderLabel,
  sanitizeFileName,
  splitClientName,
  toAsciiLabel,
} from './formatters.js';
import { parseExportRequest } from './request-parsers.js';
import { createZipBuffer, normalizeBuffer } from './zip.factory.js';
import type { AdminExportFormat, ExportEntry, ExportPeriod } from './types.js';
import {
  buildTimesheetDetailRows,
  summarizeTimesheetByProject,
} from '../../domain/timesheet-detail-rows.js';

const toSheetSafeName = (name: string, used: Set<string>): string => {
  const sanitized = name
    .replace(/[\\[\]*?:\]]/g, ' ')
    .replace(/\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = sanitized.length > 0 ? sanitized : exportLabel("Planilha");
  let candidate = base.slice(0, 31);
  let index = 1;
  while (used.has(candidate)) {
    const suffix = ` ${index}`;
    candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
};

const autoFitColumns = (sheet: ExcelJS.Worksheet, min = 10, max = 60) => {
  sheet.columns?.forEach((column) => {
    const key = column.key as string | undefined;
    if (!key) return;
    const header = typeof column.header === 'string' ? column.header : key;
    let width = header.length;
    sheet.eachRow((row) => {
      const cell = row.getCell(key);
      const raw = cell.value;
      const text =
        raw === null || raw === undefined
          ? ''
          : typeof raw === 'object' && 'text' in (raw as { text?: unknown })
            ? String((raw as { text?: unknown }).text ?? '')
            : String(raw);
      width = Math.max(width, text.length);
    });
    column.width = Math.min(max, Math.max(min, width + 2));
  });
};

const autoFitColumnByIndex = (
  sheet: ExcelJS.Worksheet,
  columnIndex: number,
  min = 10,
  max = 60
) => {
  const column = sheet.getColumn(columnIndex);
  let width = typeof column.width === 'number' ? Math.round(column.width) : min;
  sheet.eachRow((row) => {
    const raw = row.getCell(columnIndex).value;
    const text =
      raw === null || raw === undefined
        ? ''
        : typeof raw === 'object' && 'text' in (raw as { text?: unknown })
          ? String((raw as { text?: unknown }).text ?? '')
          : String(raw);
    width = Math.max(width, text.length);
  });
  column.width = Math.min(max, Math.max(min, width + 2));
};

const minutesToExcelDuration = (minutes: number): number => minutes / (24 * 60);

const allocateOvertimeByClient = (
  minutesByClient: Map<number, number>,
  targetByClient: Map<number, number>
): Map<number, number> => {
  return computeOvertimeByAllocation(minutesByClient, targetByClient).overtimeByClient;
};

export const buildTimesheetWorkbook = (
  entries: ExportEntry[],
  clientName: string,
  consultantName: string,
  month: number,
  year: number
): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();
  const usedSheetNames = new Set<string>();
  const sheet = workbook.addWorksheet(toSheetSafeName(clientName, usedSheetNames));
  const monthLabel = getMonthLabel(month);
  const detailRows = buildTimesheetDetailRows(entries, year, month);
  const projectTotals = summarizeTimesheetByProject(detailRows);
  const colors = {
    headerGreen: 'FF00755B',
    totalGreen: 'FF00755B',
    labelBlue: 'FF003366',
    weekdayFill: 'FFEFEFEF',
    weekendFill: 'FFFCE5CD',
    borderDark: 'FF000000',
    borderLight: 'FFBFBFBF',
    weekendText: 'FFFF0000',
  };
  const headerFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: colors.headerGreen },
  };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' } };
  const labelFont = { bold: true, color: { argb: colors.labelBlue } };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: colors.borderLight } },
    left: { style: 'thin', color: { argb: colors.borderLight } },
    bottom: { style: 'thin', color: { argb: colors.borderLight } },
    right: { style: 'thin', color: { argb: colors.borderLight } },
  };
  const outlineBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: colors.borderDark } },
    left: { style: 'medium', color: { argb: colors.borderDark } },
    bottom: { style: 'medium', color: { argb: colors.borderDark } },
    right: { style: 'medium', color: { argb: colors.borderDark } },
  };

  // Layout aligned to client timesheets (e.g. MRN Set.26): Data | Dia | Atividade | Projeto | Duração
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 18;
  sheet.getColumn(4).width = 58;
  sheet.getColumn(5).width = 22;
  sheet.getColumn(6).width = 16;
  sheet.properties.defaultRowHeight = 18;
  sheet.views = [{ showGridLines: false }];
  sheet.getRow(4).height = 22;

  sheet.getRow(2).getCell(2).value = exportLabel('Empresa:');
  sheet.getRow(2).getCell(2).font = labelFont;
  const clientParts = splitClientName(clientName);
  sheet.getRow(2).getCell(4).value = clientParts.part1;
  sheet.getRow(2).getCell(4).font = { bold: true };
  sheet.getRow(2).getCell(4).alignment = { horizontal: 'center' };
  if (clientParts.part2) {
    sheet.getRow(2).getCell(5).value = clientParts.part2;
    sheet.getRow(2).getCell(5).font = { bold: true };
    sheet.getRow(2).getCell(5).alignment = { horizontal: 'center' };
  }

  sheet.getRow(3).getCell(2).value = exportLabel('Consultor Externo:');
  sheet.getRow(3).getCell(2).font = labelFont;
  sheet.getRow(3).getCell(4).value = consultantName;
  sheet.getRow(3).getCell(4).font = { italic: true };
  sheet.getRow(3).getCell(4).alignment = { horizontal: 'center' };
  sheet.getRow(3).getCell(6).value = ` Mês: ${monthLabel}`;
  sheet.getRow(3).getCell(6).font = { bold: true };
  sheet.getRow(3).getCell(6).alignment = { horizontal: 'right' };

  sheet.getRow(4).getCell(2).value = exportLabel('Data');
  sheet.getRow(4).getCell(3).value = exportLabel('Dia da semana');
  sheet.getRow(4).getCell(4).value = exportLabel('Atividade');
  sheet.getRow(4).getCell(5).value = exportLabel('Projeto');
  sheet.getRow(4).getCell(6).value = exportLabel('Duração');
  [2, 3, 4, 5, 6].forEach((col) => {
    const cell = sheet.getRow(4).getCell(col);
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Sparse rows: one row per day×project (two projects on the same day → two rows).
  detailRows.forEach((detail, index) => {
    const rowIndex = 5 + index;
    const weekday = getWeekdayLabel(detail.date.getUTCDay());
    const isWeekend = weekday === 'sábado' || weekday === 'domingo';
    const row = sheet.getRow(rowIndex);
    row.getCell(2).value = formatDatePtBr(detail.day, month, year);
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).value = weekday;
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).value = detail.activity || null;
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(5).value = detail.projectName;
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(6).value = detail.durationMinutes / (24 * 60);
    row.getCell(6).numFmt = '[h]:mm';
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    [2, 3, 4, 5, 6].forEach((col) => {
      const cell = row.getCell(col);
      cell.border = thinBorder;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isWeekend ? colors.weekendFill : colors.weekdayFill },
      } as ExcelJS.FillPattern;
      cell.alignment = { ...cell.alignment, vertical: 'middle' };
    });
    if (isWeekend) {
      row.getCell(3).font = { color: { argb: colors.weekendText } };
    }
  });

  const firstDataRow = 5;
  const lastDataRow = detailRows.length > 0 ? 4 + detailRows.length : 4;
  const totalRowIndex = lastDataRow + 1;
  const totalRow = sheet.getRow(totalRowIndex);
  sheet.mergeCells(`B${totalRowIndex}:E${totalRowIndex}`);
  [2, 3, 4, 5, 6].forEach((col) => {
    const cell = totalRow.getCell(col);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colors.totalGreen },
    } as ExcelJS.FillPattern;
    cell.border = thinBorder;
  });
  totalRow.getCell(2).value = exportLabel('Total (visível no filtro)');
  totalRow.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  // SUBTOTAL ignores rows hidden by AutoFilter on Projeto (same UX as the MRN sheet).
  totalRow.getCell(6).value =
    detailRows.length > 0
      ? { formula: `SUBTOTAL(109,F${firstDataRow}:F${lastDataRow})` }
      : 0;
  totalRow.getCell(6).numFmt = '[h]:mm:ss';
  totalRow.getCell(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

  if (detailRows.length > 0) {
    sheet.autoFilter = {
      from: { row: 4, column: 2 },
      to: { row: lastDataRow, column: 6 },
    };
  }

  for (let rowIndex = 2; rowIndex <= totalRowIndex; rowIndex += 1) {
    for (let col = 2; col <= 6; col += 1) {
      const cell = sheet.getRow(rowIndex).getCell(col);
      const border = { ...cell.border } as ExcelJS.Borders;
      if (rowIndex === 2 && outlineBorder.top) border.top = outlineBorder.top;
      if (rowIndex === totalRowIndex && outlineBorder.bottom) {
        border.bottom = outlineBorder.bottom;
      }
      if (col === 2 && outlineBorder.left) border.left = outlineBorder.left;
      if (col === 6 && outlineBorder.right) border.right = outlineBorder.right;
      cell.border = border;
    }
  }

  autoFitColumnByIndex(sheet, 2, 14, 18);
  autoFitColumnByIndex(sheet, 3, 18, 24);
  autoFitColumnByIndex(sheet, 4, 58, 72);
  autoFitColumnByIndex(sheet, 5, 16, 28);
  autoFitColumnByIndex(sheet, 6, 16, 20);

  if (projectTotals.length > 1) {
    const summary = workbook.addWorksheet(toSheetSafeName(exportLabel('Por projeto'), usedSheetNames));
    summary.getRow(1).getCell(1).value = exportLabel('Projeto');
    summary.getRow(1).getCell(2).value = exportLabel('Duração');
    [1, 2].forEach((col) => {
      const cell = summary.getRow(1).getCell(col);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = thinBorder;
    });
    projectTotals.forEach((item, index) => {
      const row = summary.getRow(2 + index);
      row.getCell(1).value = item.projectName;
      row.getCell(2).value = item.durationMinutes / (24 * 60);
      row.getCell(2).numFmt = '[h]:mm';
      [1, 2].forEach((col) => {
        row.getCell(col).border = thinBorder;
      });
    });
    summary.getColumn(1).width = 28;
    summary.getColumn(2).width = 14;
    summary.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1 + projectTotals.length, column: 2 },
    };
  }

  return workbook;
};

export const buildExecutiveWorkbook = async (
  entries: ExportEntry[],
  month: number,
  year: number
): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();
  const summary = workbook.addWorksheet(exportLabel("Resumo"));
  const byClient = new Map<number, { name: string; minutes: number }>();
  const byConsultant = new Map<number, { name: string; minutes: number }>();
  const byConsultantClient = new Map<number, Map<number, { name: string; minutes: number }>>();
  let totalMinutes = 0;

  entries.forEach((entry) => {
    totalMinutes += entry.durationMinutes;
    const clientAggregate = byClient.get(entry.clientId);
    byClient.set(entry.clientId, {
      name: entry.clientName,
      minutes: (clientAggregate?.minutes ?? 0) + entry.durationMinutes,
    });

    const consultantAggregate = byConsultant.get(entry.userId);
    byConsultant.set(entry.userId, {
      name: entry.consultantName,
      minutes: (consultantAggregate?.minutes ?? 0) + entry.durationMinutes,
    });

    const consultantClients = byConsultantClient.get(entry.userId) ?? new Map();
    const consultantClientAggregate = consultantClients.get(entry.clientId);
    consultantClients.set(entry.clientId, {
      name: entry.clientName,
      minutes: (consultantClientAggregate?.minutes ?? 0) + entry.durationMinutes,
    });
    byConsultantClient.set(entry.userId, consultantClients);
  });

  const cycleSummaryByUser = new Map<number, CycleSummaryResult>(
    await Promise.all(
      Array.from(byConsultant.keys()).map(
        async (userId) =>
          [userId, await computeCycleSummaryForUser({ userId, month, year })] as const
      )
    )
  );

  const userIds = Array.from(byConsultant.keys());
  const targetByUserClient = new Map<number, Map<number, number>>();
  if (userIds.length > 0) {
    const allocations = await prisma.$queryRaw<
      Array<{
        userId: number;
        clientId: number;
        allocationType: 'DAILY' | 'MONTHLY';
        hoursPerDay: number | null;
        hoursPerMonth: number | null;
      }>
    >(Prisma.sql`
      SELECT userId, clientId, allocationType, hoursPerDay, hoursPerMonth
      FROM client_allocations
      WHERE userId IN (${Prisma.join(userIds)})
    `);
    const workingDays = getWorkingDaysInMonth(year, month);
    allocations.forEach((allocation) => {
      const targetMinutes =
        allocation.allocationType === 'DAILY'
          ? Math.round((allocation.hoursPerDay ?? 0) * workingDays * 60)
          : Math.round((allocation.hoursPerMonth ?? 0) * 60);
      const byClientTarget = targetByUserClient.get(allocation.userId) ?? new Map<number, number>();
      byClientTarget.set(allocation.clientId, targetMinutes);
      targetByUserClient.set(allocation.userId, byClientTarget);
    });
  }

  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
  const monthLabel = getMonthLabel(month);

  summary.views = [{ showGridLines: false }];
  summary.getColumn(1).width = 46;
  summary.getColumn(2).width = 14;
  summary.mergeCells('A1:B1');
  summary.getCell('A1').value = `Resumo Executivo - ${monthLabel}/${year}`;
  summary.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  summary.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  summary.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
  summary.getCell('A3').value = 'Total de horas';
  summary.getCell('B3').value = totalHours;
  summary.getCell('B3').numFmt = '0.00';
  summary.getCell('A4').value = 'Total de consultores ativos';
  summary.getCell('B4').value = byConsultant.size;
  summary.getCell('A5').value = 'Total de clientes ativos';
  summary.getCell('B5').value = byClient.size;
  [3, 4, 5].forEach((row) => {
    const keyCell = summary.getCell(`A${row}`);
    const valueCell = summary.getCell(`B${row}`);
    keyCell.font = { bold: true, color: { argb: 'FF111827' } };
    valueCell.font = { bold: true, color: { argb: 'FF111827' } };
    keyCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: row % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' },
    };
    valueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: row % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' },
    };
    keyCell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
    valueCell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
    valueCell.alignment = { horizontal: 'right', vertical: 'middle' };
  });

  const clientSheet = workbook.addWorksheet('Detalhe Clientes');
  clientSheet.columns = [
    { header: exportLabel("Cliente"), key: 'client', width: 32 },
    { header: 'Horas totais', key: 'totalHours', width: 14 },
    { header: exportLabel("Horas normais"), key: 'normalHours', width: 14 },
    { header: exportLabel("Horas extras"), key: 'overtimeHours', width: 14 },
  ];
  clientSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  clientSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' },
  };
  clientSheet.views = [{ state: 'frozen', ySplit: 1 }];
  clientSheet.autoFilter = 'A1:D1';
  const clientOvertime = new Map<number, number>();
  byConsultantClient.forEach((minutesByClient, consultantId) => {
    const actualMinutesByClient = new Map<number, number>();
    minutesByClient.forEach((item, clientId) => {
      actualMinutesByClient.set(clientId, item.minutes);
    });
    const overtimeMap = allocateOvertimeByClient(
      actualMinutesByClient,
      targetByUserClient.get(consultantId) ?? new Map<number, number>()
    );
    overtimeMap.forEach((minutes, clientId) => {
      if (!minutes) return;
      clientOvertime.set(clientId, (clientOvertime.get(clientId) ?? 0) + minutes);
    });
  });

  Array.from(byClient.entries())
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .forEach(([clientId, client]) => {
      const overtimeMinutes = clientOvertime.get(clientId) ?? 0;
      const normalMinutes = Math.max(0, client.minutes - overtimeMinutes);
      clientSheet.addRow({
        client: client.name,
        totalHours: minutesToExcelDuration(client.minutes),
        normalHours: minutesToExcelDuration(normalMinutes),
        overtimeHours: minutesToExcelDuration(overtimeMinutes),
      });
    });
  clientSheet.eachRow((row, rowNumber) => {
    [2, 3, 4].forEach((col) => {
      row.getCell(col).numFmt = '[h]:mm';
      row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
    });
    if (rowNumber > 1) {
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      if (rowNumber % 2 === 0) {
        [1, 2, 3, 4].forEach((col) => {
          row.getCell(col).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        });
      }
    }
    [1, 2, 3, 4].forEach((col) => {
      row.getCell(col).border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });
  autoFitColumns(clientSheet, 12, 48);

  const consultantSheet = workbook.addWorksheet('Detalhe Consultores');
  consultantSheet.columns = [
    { header: 'Consultor/Manager', key: 'consultant', width: 32 },
    { header: exportLabel("Cliente"), key: 'client', width: 30 },
    { header: 'Horas totais', key: 'totalHours', width: 14 },
    { header: exportLabel("Horas normais"), key: 'normalHours', width: 14 },
    { header: exportLabel("Horas extras"), key: 'overtimeHours', width: 14 },
  ];
  consultantSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  consultantSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFB45309' },
  };
  consultantSheet.views = [{ state: 'frozen', ySplit: 1 }];
  consultantSheet.autoFilter = 'A1:E1';
  Array.from(byConsultant.entries())
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .forEach(([consultantId, consultant]) => {
      const minutesByClient = byConsultantClient.get(consultantId) ?? new Map();
      const actualMinutesByClient = new Map<number, number>();
      minutesByClient.forEach((item, clientId) => {
        actualMinutesByClient.set(clientId, item.minutes);
      });
      const overtimeMap = allocateOvertimeByClient(
        actualMinutesByClient,
        targetByUserClient.get(consultantId) ?? new Map<number, number>()
      );
      const overtimeMinutes = Array.from(overtimeMap.values()).reduce(
        (acc, value) => acc + value,
        0
      );
      const normalMinutes = Math.max(0, consultant.minutes - overtimeMinutes);

      const totalRow = consultantSheet.addRow({
        consultant: consultant.name,
        client: '-',
        totalHours: minutesToExcelDuration(consultant.minutes),
        normalHours: minutesToExcelDuration(normalMinutes),
        overtimeHours: minutesToExcelDuration(overtimeMinutes),
      });
      totalRow.font = { bold: true };
      [1, 2, 3, 4, 5].forEach((col) => {
        totalRow.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      });

      Array.from(minutesByClient.entries())
        .sort((a, b) => b[1].minutes - a[1].minutes)
        .forEach(([clientId, client]) => {
          const clientOvertimeMinutes = overtimeMap.get(clientId) ?? 0;
          const clientNormalMinutes = Math.max(0, client.minutes - clientOvertimeMinutes);
          consultantSheet.addRow({
            consultant: '',
            client: `- ${client.name}`,
            totalHours: minutesToExcelDuration(client.minutes),
            normalHours: minutesToExcelDuration(clientNormalMinutes),
            overtimeHours: minutesToExcelDuration(clientOvertimeMinutes),
          });
        });
    });
  consultantSheet.eachRow((row, rowNumber) => {
    [3, 4, 5].forEach((col) => {
      row.getCell(col).numFmt = '[h]:mm';
      row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
    });
    if (rowNumber > 1) {
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      if (!row.getCell(1).value) {
        row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        if (rowNumber % 2 === 0) {
          [1, 2, 3, 4, 5].forEach((col) => {
            row.getCell(col).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' },
            };
          });
        }
      }
    }
    [1, 2, 3, 4, 5].forEach((col) => {
      row.getCell(col).border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });
  autoFitColumns(consultantSheet, 12, 52);

  const detailSheet = workbook.addWorksheet('Detalhe Lancamentos');
  detailSheet.columns = [
    { header: exportLabel("Data"), key: 'date', width: 14 },
    { header: exportLabel("Consultor"), key: 'consultant', width: 28 },
    { header: exportLabel("Cliente"), key: 'client', width: 28 },
    { header: exportLabel("Atividade"), key: 'activity', width: 60 },
    { header: exportLabel("Duração"), key: 'duration', width: 12 },
  ];
  detailSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  detailSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };
  detailSheet.views = [{ state: 'frozen', ySplit: 1 }];
  detailSheet.autoFilter = 'A1:E1';
  entries.forEach((entry) => {
    const row = detailSheet.addRow({
      date: entry.date,
      consultant: entry.consultantName,
      client: entry.clientName,
      activity: entry.activityDescription,
      duration: entry.durationMinutes / (24 * 60),
    });
    row.getCell(1).numFmt = 'dd/mm/yy';
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(5).numFmt = '[h]:mm';
    row.getCell(5).alignment = { horizontal: 'center' };
  });
  detailSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      [1, 2, 3, 4, 5].forEach((col) => {
        row.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      });
    }
    [1, 2, 3, 4, 5].forEach((col) => {
      row.getCell(col).border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });
  autoFitColumns(detailSheet, 12, 64);

  const addCycleSheet = (
    sheetName: string,
    mode: 'closedCycle' | 'nextCyclePreview',
    periodLabel: string
  ) => {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = [
      { header: 'Consultor/Manager', key: 'consultant', width: 30 },
      { header: exportLabel("Cliente"), key: 'client', width: 28 },
      { header: exportLabel("Periodo"), key: 'period', width: 24 },
      { header: 'Horas trabalhadas', key: 'workedHours', width: 16 },
      { header: 'Meta (alocada)', key: 'targetHours', width: 16 },
      { header: exportLabel("Horas normais"), key: 'normalHours', width: 14 },
      { header: exportLabel("Horas extras"), key: 'overtimeHours', width: 14 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: mode === 'closedCycle' ? 'FF166534' : 'FF334155' },
    };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = 'A1:G1';

    Array.from(byConsultant.entries())
      .sort((a, b) => a[1].name.localeCompare(b[1].name, 'pt-BR'))
      .forEach(([userId, consultant]) => {
        const cycleSummary = cycleSummaryByUser.get(userId);
        if (!cycleSummary) return;
        const totals = cycleSummary.totals[mode];
        const totalRow = sheet.addRow({
          consultant: consultant.name,
          client: '-',
          period: periodLabel,
          workedHours: minutesToExcelDuration(totals.workedMinutes),
          targetHours: minutesToExcelDuration(totals.targetMinutes),
          normalHours: minutesToExcelDuration(totals.normalMinutes),
          overtimeHours: minutesToExcelDuration(totals.overtimeMinutes),
        });
        totalRow.font = { bold: true };
        [1, 2, 3, 4, 5, 6, 7].forEach((col) => {
          totalRow.getCell(col).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        });

        cycleSummary.byClient
          .filter((item: ClientCycleSummary) => {
            const selected = item[mode];
            return selected.workedMinutes > 0 || selected.targetMinutes > 0;
          })
          .sort((a: ClientCycleSummary, b: ClientCycleSummary) =>
            a.clientName.localeCompare(b.clientName, 'pt-BR')
          )
          .forEach((item: ClientCycleSummary) => {
            const selected = item[mode];
            sheet.addRow({
              consultant: '',
              client: `- ${item.clientName}`,
              period: `${selected.startDate}..${selected.endDate}`,
              workedHours: minutesToExcelDuration(selected.workedMinutes),
              targetHours: minutesToExcelDuration(selected.targetMinutes),
              normalHours: minutesToExcelDuration(selected.normalMinutes),
              overtimeHours: minutesToExcelDuration(selected.overtimeMinutes),
            });
          });
      });

    sheet.eachRow((row, rowNumber) => {
      [4, 5, 6, 7].forEach((col) => {
        row.getCell(col).numFmt = '[h]:mm';
        row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
      });
      if (rowNumber > 1) {
        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        if (!row.getCell(1).value) {
          row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        }
      }
      [1, 2, 3, 4, 5, 6, 7].forEach((col) => {
        row.getCell(col).border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });
    autoFitColumns(sheet, 12, 44);
  };

  addCycleSheet('Ciclo Fechado', 'closedCycle', `${monthLabel}/${year}`);
  addCycleSheet('Previa Prox Ciclo', 'nextCyclePreview', `${monthLabel}/${year}`);

  try {
    const { ChartJSNodeCanvas } = await import('chartjs-node-canvas');
    const chart = new ChartJSNodeCanvas({ width: 900, height: 420, backgroundColour: 'white' });
    const topClients = Array.from(byClient.entries())
      .sort((a, b) => b[1].minutes - a[1].minutes)
      .slice(0, 5);
    const baseOptions = {
      responsive: false,
      animation: false as const,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: {
            color: '#334155',
            maxRotation: 30,
            minRotation: 0,
            autoSkip: false,
            font: { family: 'DejaVu Sans', size: 11 },
          },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#334155',
            precision: 0,
            font: { family: 'DejaVu Sans', size: 11 },
          },
          grid: { color: '#E2E8F0' },
        },
      },
    };
    const clientImage = await chart.renderToBuffer({
      type: 'bar',
      data: {
        labels: topClients.map(([, client]) => toAsciiLabel(client.name)),
        datasets: [
          {
            label: 'Horas por cliente',
            data: topClients.map(([, client]) => Math.round((client.minutes / 60) * 100) / 100),
            backgroundColor: '#0f766e',
          },
        ],
      },
      options: {
        ...baseOptions,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Horas por cliente',
            color: '#0F172A',
            font: { family: 'DejaVu Sans', size: 14, weight: 'bold' },
          },
        },
      },
    });

    const topConsultants = Array.from(byConsultant.entries())
      .sort((a, b) => b[1].minutes - a[1].minutes)
      .slice(0, 5);
    const consultantImage = await chart.renderToBuffer({
      type: 'bar',
      data: {
        labels: topConsultants.map(([, consultant]) => toAsciiLabel(consultant.name)),
        datasets: [
          {
            label: 'Horas por consultor',
            data: topConsultants.map(
              ([, consultant]) => Math.round((consultant.minutes / 60) * 100) / 100
            ),
            backgroundColor: '#b45309',
          },
        ],
      },
      options: {
        ...baseOptions,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Horas por consultor',
            color: '#0F172A',
            font: { family: 'DejaVu Sans', size: 14, weight: 'bold' },
          },
        },
      },
    });

    const clientImageBuffer = normalizeBuffer(clientImage);
    const clientImageId = workbook.addImage({
      base64: clientImageBuffer.toString('base64'),
      extension: 'png',
    });
    summary.addImage(clientImageId, {
      tl: { col: 0, row: 7 },
      ext: { width: 600, height: 300 },
    });

    const consultantImageBuffer = normalizeBuffer(consultantImage);
    const consultantImageId = workbook.addImage({
      base64: consultantImageBuffer.toString('base64'),
      extension: 'png',
    });
    summary.addImage(consultantImageId, {
      tl: { col: 8, row: 7 },
      ext: { width: 600, height: 300 },
    });
  } catch (_error) {
    summary.getCell('A7').value = 'Graficos indisponiveis (dependencias nao instaladas).';
  }

  return workbook;
};

export const exportTimeEntriesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { periods, month, year, consultantId, clientId, mode, requestedFormat } =
      parseExportRequest(req.query);
    const adminFormat: AdminExportFormat =
      requestedFormat === 'detailed' ? 'detailed' : 'executive';
    const effectivePeriods =
      periods.length > 0
        ? periods
        : [{ month: month ?? 0, year: year ?? 0 }].filter((item) => !!item.month && !!item.year);

    if (periods.length > 0 && req.user?.roleId !== 1) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    if (requestedFormat && req.user?.roleId !== 1) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    if (
      effectivePeriods.length === 0 ||
      effectivePeriods.some(
        (item) =>
          Number.isNaN(item.month) || Number.isNaN(item.year) || item.month < 1 || item.month > 12
      )
    ) {
      res.status(400).json({ success: false, error: 'Month and year are required' });
      return;
    }

    let userIds: number[] | undefined;

    if (req.user?.roleId === 3) {
      userIds = [req.user.userId];
      if (consultantId && consultantId !== req.user.userId) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
    }

    if (req.user?.roleId === 2) {
      const managerPeriod = effectivePeriods[0];
      const periodStart = new Date(Date.UTC(managerPeriod.year, managerPeriod.month - 1, 1));
      const periodEnd = new Date(Date.UTC(managerPeriod.year, managerPeriod.month, 0));
      const [managedUsers, historicalManagedUsers] = await Promise.all([
        prisma.user.findMany({
          where: { managerId: req.user.userId, roleId: 3 },
          select: { id: true },
        }),
        prisma.$queryRaw<Array<{ consultantId: number }>>(Prisma.sql`
          SELECT DISTINCT consultantId
          FROM manager_assignment_history
          WHERE managerId = ${req.user.userId}
            AND startDate <= ${periodEnd}
            AND (endDate IS NULL OR endDate >= ${periodStart})
        `),
      ]);
      userIds = Array.from(
        new Set([
          req.user.userId,
          ...managedUsers.map((user) => user.id),
          ...historicalManagedUsers.map((item) => Number(item.consultantId)),
        ])
      );

      if (consultantId && !userIds.includes(consultantId)) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
    }

    const isMultiPeriodAdminExport = req.user?.roleId === 1 && effectivePeriods.length > 1;
    const logAdminExport = async (filesCount: number) => {
      if (req.user?.roleId !== 1 || !req.user.userId) return;
      const action =
        adminFormat === 'detailed'
          ? effectivePeriods.length > 1
            ? 'ADMIN_EXPORT_DETAILED_MULTI_PERIOD'
            : 'ADMIN_EXPORT_DETAILED'
          : effectivePeriods.length > 1
            ? 'ADMIN_EXPORT_MULTI_PERIOD'
            : 'ADMIN_EXPORT_EXECUTIVE';
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          endpoint: '/api/export/time-entries',
          action,
          status: 'success',
          details: JSON.stringify({
            format: adminFormat,
            periods: effectivePeriods,
            consultantId: consultantId ?? null,
            clientId: clientId ?? null,
            files: filesCount,
          }).slice(0, 4000),
        },
      });
    };

    const buildFilesForPeriod = async (period: ExportPeriod) => {
      const data = await getExportData({
        month: period.month,
        year: period.year,
        consultantId,
        clientId,
        userIds,
      });
      const monthSuffix = `${period.year}-${String(period.month).padStart(2, '0')}`;

      if (req.user?.roleId === 1) {
        if (adminFormat === 'detailed') {
          const detailedEntries = data.filter((entry) => entry.roleId === 2 || entry.roleId === 3);
          const groupedByClient = detailedEntries.reduce(
            (acc, entry) => {
              if (!acc[entry.clientName]) acc[entry.clientName] = [];
              acc[entry.clientName].push(entry);
              return acc;
            },
            {} as Record<string, typeof detailedEntries>
          );

          const filesByClientAndRole: Array<{ name: string; buffer: Buffer }> = [];
          for (const [entryClientName, clientEntries] of Object.entries(groupedByClient)) {
            const groupedByUser = clientEntries.reduce(
              (acc, entry) => {
                if (!acc[entry.userId]) acc[entry.userId] = [];
                acc[entry.userId].push(entry);
                return acc;
              },
              {} as Record<number, typeof clientEntries>
            );

            for (const userEntries of Object.values(groupedByUser)) {
              if (userEntries.length === 0) continue;
              const first = userEntries[0];
              const roleFolder = first.roleId === 2 ? 'managers' : 'consultores';
              const workbook = buildTimesheetWorkbook(
                userEntries,
                entryClientName,
                first.userName,
                period.month,
                period.year
              );
              const buffer = await workbook.xlsx.writeBuffer();
              filesByClientAndRole.push({
                name: `${sanitizeFileName(entryClientName)}/${roleFolder}/${sanitizeFileName(
                  first.userName
                )} - ${sanitizeFileName(entryClientName)} - ${monthSuffix}.xlsx`,
                buffer: normalizeBuffer(buffer),
              });
            }
          }
          return filesByClientAndRole;
        }

        if (isMultiPeriodAdminExport) {
          const groupedByClient = data.reduce(
            (acc, entry) => {
              if (!acc[entry.clientName]) acc[entry.clientName] = [];
              acc[entry.clientName].push(entry);
              return acc;
            },
            {} as Record<string, typeof data>
          );

          const filesByClient: Array<{ name: string; buffer: Buffer }> = [];
          for (const [entryClientName, clientEntries] of Object.entries(groupedByClient)) {
            const clientWorkbook = await buildExecutiveWorkbook(
              clientEntries,
              period.month,
              period.year
            );
            const clientBuffer = await clientWorkbook.xlsx.writeBuffer();
            filesByClient.push({
              name: `${sanitizeFileName(entryClientName)} - ${monthSuffix}.xlsx`,
              buffer: normalizeBuffer(clientBuffer),
            });
          }
          return filesByClient;
        }

        const adminWorkbook = await buildExecutiveWorkbook(data, period.month, period.year);
        const buffer = await adminWorkbook.xlsx.writeBuffer();
        return [
          {
            name: `relatorio-executivo-${monthSuffix}.xlsx`,
            buffer: normalizeBuffer(buffer),
          },
        ];
      }

      if (req.user?.roleId === 2 && mode === 'client-consultants' && !clientId) {
        throw new BadRequestError('clientId is required for this mode');
      }

      const files: Array<{ name: string; buffer: Buffer }> = [];

      if (req.user?.roleId === 2 && mode === 'client-consultants' && clientId) {
        const groupedByConsultant = data.reduce(
          (acc, entry) => {
            const key = entry.consultantName;
            if (!acc[key]) acc[key] = [];
            acc[key].push(entry);
            return acc;
          },
          {} as Record<string, typeof data>
        );

        for (const [consultantName, entries] of Object.entries(groupedByConsultant)) {
          if (entries.length === 0) continue;
          const workbook = buildTimesheetWorkbook(
            entries,
            entries[0].clientName,
            consultantName,
            period.month,
            period.year
          );
          const buffer = await workbook.xlsx.writeBuffer();
          files.push({
            name: `${sanitizeFileName(consultantName)} - ${sanitizeFileName(
              entries[0].clientName
            )} - ${monthSuffix}.xlsx`,
            buffer: normalizeBuffer(buffer),
          });
        }
        return files;
      }

      if (req.user?.roleId === 2 && !consultantId) {
        const groupedByConsultantAndClient = data.reduce(
          (acc, entry) => {
            const key = `${entry.consultantName}::${entry.clientName}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(entry);
            return acc;
          },
          {} as Record<string, typeof data>
        );

        for (const [key, entries] of Object.entries(groupedByConsultantAndClient)) {
          if (entries.length === 0) continue;
          const [consultantName, clientName] = key.split('::');
          const workbook = buildTimesheetWorkbook(
            entries,
            clientName,
            consultantName,
            period.month,
            period.year
          );
          const buffer = await workbook.xlsx.writeBuffer();
          files.push({
            name: `${sanitizeFileName(consultantName)} - ${sanitizeFileName(
              clientName
            )} - ${monthSuffix}.xlsx`,
            buffer: normalizeBuffer(buffer),
          });
        }
        return files;
      }

      const groupedByClient = data.reduce(
        (acc, entry) => {
          const key = entry.clientName;
          if (!acc[key]) acc[key] = [];
          acc[key].push(entry);
          return acc;
        },
        {} as Record<string, typeof data>
      );

      for (const [entryClientName, entries] of Object.entries(groupedByClient)) {
        if (entries.length === 0) continue;
        const consultantName =
          consultantId && entries.length > 0
            ? entries[0].consultantName
            : req.user?.roleId === 3
              ? (entries[0]?.consultantName ?? exportLabel("Consultor"))
              : (entries[0]?.consultantName ?? exportLabel("Consultor"));
        const workbook = buildTimesheetWorkbook(
          entries,
          entryClientName,
          consultantName,
          period.month,
          period.year
        );
        const buffer = await workbook.xlsx.writeBuffer();
        files.push({
          name: `${sanitizeFileName(entryClientName)} - ${monthSuffix}.xlsx`,
          buffer: normalizeBuffer(buffer),
        });
      }

      return files;
    };

    if (effectivePeriods.length === 1) {
      const files = await buildFilesForPeriod(effectivePeriods[0]);

      if (files.length === 0) {
        const emptyWorkbook = new ExcelJS.Workbook();
        const sheet = emptyWorkbook.addWorksheet('Sem dados');
        sheet.getCell('A1').value = 'Nenhum lancamento encontrado para o periodo selecionado.';
        const buffer = await emptyWorkbook.xlsx.writeBuffer();
        const payload = normalizeBuffer(buffer);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename="sem-dados.xlsx"');
        await logAdminExport(1);
        res.status(200).send(payload);
        return;
      }

      if (files.length === 1) {
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${files[0].name}"`);
        await logAdminExport(1);
        res.status(200).send(files[0].buffer);
        return;
      }

      const monthSuffix = `${effectivePeriods[0].year}-${String(effectivePeriods[0].month).padStart(2, '0')}`;
      const zipBuffer = await createZipBuffer(files);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="relatorios-${monthSuffix}.zip"`);
      await logAdminExport(files.length);
      res.status(200).send(zipBuffer);
      return;
    }

    const currentYear = new Date().getUTCFullYear();
    const uniqueYears = new Set(effectivePeriods.map((period) => period.year));
    const includeYearFolder = !(
      uniqueYears.size === 1 && Array.from(uniqueYears)[0] === currentYear
    );
    const files: Array<{ name: string; buffer: Buffer }> = [];

    for (const period of effectivePeriods) {
      const periodFiles = await buildFilesForPeriod(period);
      const folder = includeYearFolder
        ? `${period.year}/${monthFolderLabel(period.month)}`
        : monthFolderLabel(period.month);

      if (periodFiles.length === 0) {
        const emptyWorkbook = new ExcelJS.Workbook();
        const sheet = emptyWorkbook.addWorksheet('Sem dados');
        sheet.getCell('A1').value = 'Nenhum lancamento encontrado para o periodo selecionado.';
        const buffer = await emptyWorkbook.xlsx.writeBuffer();
        files.push({
          name: `${folder}/sem-dados.xlsx`,
          buffer: normalizeBuffer(buffer),
        });
        continue;
      }

      periodFiles.forEach((file) => {
        files.push({
          name: `${folder}/${file.name}`,
          buffer: file.buffer,
        });
      });
    }

    await logAdminExport(files.length);

    const zipBuffer = await createZipBuffer(files);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="relatorios-multiplos-${Date.now()}.zip"`
    );
    res.status(200).send(zipBuffer);
  } catch (error) {
    const message = getErrorMessage(error);
    res.status(resolveErrorStatus(error)).json({ success: false, error: message });
  }
};
