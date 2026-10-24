export interface CsvUserRow {
  name: string;
  email: string;
  password?: string;
  roleId: string;
  managerId?: string;
}

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: { row: number; email: string; error: string }[];
  created: { id: number; name: string; email: string }[];
}

export interface BulkStatusUpdateResult {
  success: number;
  failed: number;
  errors: { userId: number; error: string }[];
}
