export interface UserRow {
  id: number;
  name: string;
  email: string;
  roleId: number;
  managerId: number | null;
  isActive: boolean;
  role?: { id: number; name: string };
  manager?: { id: number; name: string } | null;
}

export interface ClientRow {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
}

export interface RoleOption {
  id: number;
  name: string;
}

export interface UsersFormState {
  id: number;
  name: string;
  email: string;
  password: string;
  roleId: number;
  managerId: number;
}

export interface DeleteConfirmState {
  isOpen: boolean;
  userId: number;
  userName: string;
}
