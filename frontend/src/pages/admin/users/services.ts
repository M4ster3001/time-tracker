import api from '../../../services/api';
import type { ClientRow, UserRow } from './types';

export type ListPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const getUsers = async (params: {
  search?: string;
  roleId?: number;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
  isActive?: boolean;
  signal?: AbortSignal;
}) => {
  const response = await api.get('/api/users', {
    params: {
      search: params.search || undefined,
      roleId: params.roleId || undefined,
      includeInactive: params.includeInactive ?? true,
      isActive: typeof params.isActive === 'boolean' ? params.isActive : undefined,
      page: params.page,
      limit: params.limit,
    },
    signal: params.signal,
  });
  const pagination = (response.data.pagination || {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    total: (response.data.data || []).length,
    totalPages: 1,
  }) as ListPagination;
  return {
    data: (response.data.data || []) as UserRow[],
    pagination,
  };
};

export const getManagers = async (signal?: AbortSignal) => {
  const response = await api.get('/api/users', {
    params: { roleId: 2, includeInactive: false, limit: 100 },
    signal,
  });
  return (response.data.data || []) as UserRow[];
};

export const getClients = async (signal?: AbortSignal) => {
  const response = await api.get('/api/clients', {
    params: { includeInactive: true, limit: 100 },
    signal,
  });
  return (response.data.data || []) as ClientRow[];
};

export const getUserClients = async (
  userId: number,
  includeHistorical: boolean,
  signal?: AbortSignal
) => {
  const response = await api.get(`/api/users/${userId}/clients`, {
    params: { includeHistorical },
    signal,
  });
  return (response.data.data || []) as ClientRow[];
};

export const createUser = (payload: {
  name: string;
  email: string;
  password: string;
  roleId: number;
  managerId: number | null;
}) => api.post('/api/users', payload);

export const updateUser = (
  userId: number,
  payload: Partial<{
    name: string;
    email: string;
    roleId: number;
    managerId: number | null;
    isActive: boolean;
  }>
) => api.put(`/api/users/${userId}`, payload);

export const deleteUser = (userId: number) => api.delete(`/api/users/${userId}`);

export const toggleUserActive = (userId: number, isActive: boolean) =>
  api.put(`/api/users/${userId}`, { isActive });

export const reactivateUsers = async (userIds: number[]) =>
  Promise.all(userIds.map((id) => api.put(`/api/users/${id}`, { isActive: true })));

export const linkClientToUser = (userId: number, clientId: number) =>
  api.post(`/api/users/${userId}/clients/${clientId}`);

export const unlinkClientFromUser = (userId: number, clientId: number) =>
  api.delete(`/api/users/${userId}/clients/${clientId}`);

export const changeUserPassword = (userId: number, newPassword: string) =>
  api.post(`/api/users/${userId}/change-password`, { newPassword });
