import { text } from '../../../i18n';
import type { DeleteConfirmState, RoleOption, UsersFormState } from './types';

export const roleOptions: RoleOption[] = [
  { id: 1, name: 'Admin' },
  { id: 2, name: 'Manager' },
  { id: 3, name: 'Consultant' },
];

/** Localised display name of a legacy role id (the stored role name stays in English). */
export const roleLabel = (roleId: number): string => {
  if (roleId === 1) return text('Administrador', 'Administrator');
  if (roleId === 2) return text('Gestor', 'Manager');
  if (roleId === 3) return text('Consultor', 'Consultant');
  return String(roleId);
};

export const createEmptyUserForm = (): UsersFormState => ({
  id: 0,
  name: '',
  email: '',
  password: '',
  roleId: 3,
  managerId: 0,
});

export const createEmptyDeleteConfirm = (): DeleteConfirmState => ({
  isOpen: false,
  userId: 0,
  userName: '',
});
