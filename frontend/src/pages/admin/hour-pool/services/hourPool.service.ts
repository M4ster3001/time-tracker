import api from '../../../../services/api';
import type { HourPoolLineItem, HourPoolOption } from '../types/hourPool.types';

export const fetchHourPoolReport = async (params: {
  year: number;
  month: number;
  clientId?: number;
  consultantId?: number;
  signal?: AbortSignal;
}): Promise<HourPoolLineItem[]> => {
  const response = await api.get('/api/admin/reports/hour-pool', {
    params: {
      year: params.year,
      month: params.month,
      clientId: params.clientId,
      consultantId: params.consultantId,
    },
    signal: params.signal,
  });
  return response.data.data || [];
};

export const fetchClientOptions = async (signal?: AbortSignal): Promise<HourPoolOption[]> => {
  const response = await api.get('/api/clients', { signal });
  return (response.data.data || []).map((client: { id: number; name: string }) => ({
    id: client.id,
    name: client.name,
  }));
};

export const fetchConsultantOptions = async (signal?: AbortSignal): Promise<HourPoolOption[]> => {
  const response = await api.get('/api/users', { params: { roleId: 3 }, signal });
  return (response.data.data || []).map((user: { id: number; name: string }) => ({
    id: user.id,
    name: user.name,
  }));
};

export const downloadHourPoolExport = async (params: {
  year: number;
  month: number;
  clientId: number;
}): Promise<{ blob: Blob; fileName: string }> => {
  const response = await api.get('/api/admin/reports/hour-pool/export', {
    params,
    responseType: 'blob',
  });
  const disposition = response.headers['content-disposition'];
  const fileNameMatch = disposition?.match(/filename="?([^";]+)"?/);
  const fileName = fileNameMatch?.[1] ?? 'bolsao-horas.xlsx';
  return { blob: new Blob([response.data]), fileName };
};
