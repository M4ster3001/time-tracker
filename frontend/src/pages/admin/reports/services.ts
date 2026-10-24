import api from '../../../services/api';
import type { ClientCapacity, ConsultantPerformance, ReportType } from './types';

export const getAdminReport = async (
  reportType: ReportType,
  startDate: string,
  endDate: string
) => {
  const endpoint =
    reportType === 'consultant-performance'
      ? '/api/admin/reports/consultant-performance'
      : '/api/admin/reports/client-capacity';

  const response = await api.get(endpoint, {
    params: { startDate, endDate },
  });

  if (reportType === 'consultant-performance') {
    return {
      data: (response.data.data || []) as ConsultantPerformance[],
      summary: (response.data.summary || {}) as Record<string, number>,
    };
  }

  return {
    data: (response.data.data || []) as ClientCapacity[],
    summary: (response.data.summary || {}) as Record<string, number>,
  };
};
