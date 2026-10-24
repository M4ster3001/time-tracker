export interface AuthAuditRepository {
  log(event: {
    userId: number | null;
    action: string;
    status: 'success' | 'failure';
    details?: string;
  }): Promise<void>;
}
