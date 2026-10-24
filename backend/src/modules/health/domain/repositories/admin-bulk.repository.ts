export interface AdminBulkUserRecord {
  id: number;
  name: string;
  email: string;
  roleId?: number;
  deletedAt?: Date | null;
}

export interface AdminBulkRepository {
  listUserEmails(): Promise<string[]>;
  findManagerById(managerId: number): Promise<{ id: number } | null>;
  createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    roleId: number;
    managerId: number | null;
  }): Promise<{ id: number; name: string; email: string }>;
  findUserById(userId: number): Promise<AdminBulkUserRecord | null>;
  updateUserActive(userId: number, isActive: boolean): Promise<void>;
  logAudit(data: {
    userId: number;
    endpoint: string;
    action: string;
    status: string;
    details: string;
  }): Promise<void>;
}
