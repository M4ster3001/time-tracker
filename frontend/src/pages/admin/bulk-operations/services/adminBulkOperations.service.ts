import api from '../../../../services/api';
import type {
  BulkImportResult,
  BulkStatusResult,
  UserRow,
} from '../types/adminBulkOperations.types';

export async function fetchAdminBulkUsers(): Promise<UserRow[]> {
  const response = await api.get('/api/users', {
    params: { includeInactive: true },
  });
  return response.data.data || [];
}

export async function importAdminUsers(
  csvContent: string
): Promise<{ data: BulkImportResult; message: string }> {
  const response = await api.post('/api/admin/users/bulk-import', { csvContent });
  return { data: response.data.data, message: response.data.message };
}

export async function downloadAdminUsersTemplate(): Promise<Blob> {
  const response = await api.get('/api/admin/users/csv-template', {
    responseType: 'blob',
  });
  return new Blob([response.data]);
}

export async function bulkActivateAdminUsers(
  userIds: number[]
): Promise<{ data: BulkStatusResult; message: string }> {
  const response = await api.post('/api/admin/users/bulk-activate', { userIds });
  return { data: response.data.data, message: response.data.message };
}

export async function bulkDeactivateAdminUsers(
  userIds: number[]
): Promise<{ data: BulkStatusResult; message: string }> {
  const response = await api.post('/api/admin/users/bulk-deactivate', { userIds });
  return { data: response.data.data, message: response.data.message };
}
