import api from '../../../../services/api';
import type { HealthStatus } from '../types/adminHealth.types';

export async function fetchAdminHealth(): Promise<HealthStatus> {
  const response = await api.get('/api/admin/health');
  return response.data.data;
}
