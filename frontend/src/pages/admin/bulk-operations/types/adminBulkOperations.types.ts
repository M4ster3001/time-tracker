export interface BulkImportResult {
  success: number;
  failed: number;
  errors: { row: number; email: string; error: string }[];
  created: { id: number; name: string; email: string }[];
}

export interface BulkStatusResult {
  success: number;
  failed: number;
  errors: { userId: number; error: string }[];
}

export interface UserRow {
  id: number;
  name: string;
  email: string;
  roleId: number;
  isActive: boolean;
}
