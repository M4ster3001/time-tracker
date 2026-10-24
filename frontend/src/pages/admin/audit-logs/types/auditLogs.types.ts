export interface AuditLogRow {
  id: number;
  userId: number | null;
  endpoint: string;
  action: string;
  status: string;
  details: string | null;
  createdAt: string;
}
