import api from '../../../../services/api';
import type { AdminDashboardResponse } from '../types/dashboardAdmin.types';

export async function fetchAdminDashboardData(params: {
  month: number;
  year: number;
  dailyStartDate: string;
  dailyEndDate: string;
  signal?: AbortSignal;
}): Promise<AdminDashboardResponse> {
  const response = await api.get('/api/dashboards/admin', {
    params: {
      month: params.month,
      year: params.year,
      startDate: params.dailyStartDate,
      endDate: params.dailyEndDate,
    },
    signal: params.signal,
  });
  return response.data.data;
}
