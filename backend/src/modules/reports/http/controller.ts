import { Request, Response } from 'express';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import {
  getConsultantPerformanceReport,
  getClientCapacityReport,
} from '../application/report.service.js';
import { getHourPoolReport } from '../application/hour-pool-report.service.js';
import { sendSuccess, sendError } from '../../../app/http/presenters/api.presenter.js';
import { toAppError } from '../../../app/errors/app-error.js';
import { parseClientCapacityQuery, parseConsultantPerformanceQuery } from './report-query-parsers.js';
import { buildClientCapacityResponse, buildConsultantPerformanceResponse } from './presenters.js';
import type { HourPoolQuery } from './schemas.js';

/**
 * ADM-01: GET /api/admin/reports/consultant-performance
 * Returns performance report for consultants (hours worked vs allocated)
 */
export const consultantPerformanceReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = parseConsultantPerformanceQuery(req.query);

    const report = await getConsultantPerformanceReport({
      userId: query.userId,
      managerId: query.managerId,
      clientId: query.clientId,
      startDate: query.startDate,
      endDate: query.endDate,
      includeInactive: query.includeInactive,
    });

    res.status(200).json(buildConsultantPerformanceResponse(report));
  } catch (error) {
    logger.error({ err: error }, 'Error generating consultant performance report');
    sendError(res, toAppError(error));
  }
};

/**
 * ADM-02: GET /api/admin/reports/client-capacity
 * Returns capacity report for clients (available, used, remaining hours)
 */
export const clientCapacityReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = parseClientCapacityQuery(req.query);

    const report = await getClientCapacityReport({
      clientId: query.clientId,
      startDate: query.startDate,
      endDate: query.endDate,
      includeInactive: query.includeInactive,
    });

    res.status(200).json(buildClientCapacityResponse(report));
  } catch (error) {
    logger.error({ err: error }, 'Error generating client capacity report');
    sendError(res, toAppError(error));
  }
};

/**
 * GET /api/admin/reports/hour-pool
 * Bolsao de horas: horas trabalhadas x valor/hora por consultor x cliente no ciclo fechado do mes.
 */
export const hourPoolReportController = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query as unknown as HourPoolQuery;
    const lineItems = await getHourPoolReport({
      year: query.year,
      month: query.month,
      clientId: query.clientId,
      consultantId: query.consultantId,
    });

    sendSuccess(res, 200, lineItems);
  } catch (error) {
    logger.error({ err: error }, 'Error generating hour pool report');
    sendError(res, toAppError(error));
  }
};
