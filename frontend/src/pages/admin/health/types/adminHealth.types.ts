export interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  message: string;
  value?: number | string;
}

export interface RecentError {
  timestamp: string;
  endpoint: string;
  action: string;
  details: string | null;
}

export interface Alert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  httpStatus?: number;
  summary?: string;
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: CheckResult;
    memory: CheckResult;
    disk: CheckResult;
  };
  metrics: {
    totalUsers: number;
    activeUsers: number;
    totalClients: number;
    activeClients: number;
    totalTimeEntries: number;
    timeEntriesLast24h: number;
    recentErrors: RecentError[];
    errorRateLast24h: number;
  };
  alerts: Alert[];
  recommendations?: string[];
}
