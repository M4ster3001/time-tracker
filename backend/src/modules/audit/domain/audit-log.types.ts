export interface IAuditLog {
  id: number;
  userId: number | null;
  endpoint: string;
  action: string;
  status: string;
  details: string | null;
  detailsJson?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}
