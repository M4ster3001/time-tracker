import dotenv from 'dotenv';

import {
  assertCorsPrivateLanFlagSafe,
  resolveAllowPrivateLan,
} from './app/bootstrap/cors-private-lan-policy.js';
import {
  getAppRuntime,
  isDesktopRuntime,
  isFeatureEnabledInDesktop,
  resolveDesktopDataDir,
  resolveDesktopDatabaseUrl,
} from './shared/infrastructure/runtime/app-runtime.js';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const corsPrivateLanFlagRequested = process.env.CORS_ALLOW_PRIVATE_LAN === 'true';
assertCorsPrivateLanFlagSafe({
  env: nodeEnv,
  flagRequested: corsPrivateLanFlagRequested,
});

const runtime = getAppRuntime();
const desktopMode = isDesktopRuntime();
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const databaseUrl = desktopMode
  ? process.env.DESKTOP_DATABASE_URL || process.env.DATABASE_URL || resolveDesktopDatabaseUrl()
  : process.env.DATABASE_URL || '';
const desktopDataDir = desktopMode ? resolveDesktopDataDir() : null;
const aiEnabled =
  process.env.AI_SUGGESTIONS_ENABLED === 'true' &&
  isFeatureEnabledInDesktop('DESKTOP_ENABLE_AI', false);
const googleCalendarEnabled = desktopMode
  ? isFeatureEnabledInDesktop('DESKTOP_ENABLE_GOOGLE_CALENDAR', false)
  : process.env.GOOGLE_CALENDAR_ENABLED === 'true';
const redisEnabled =
  process.env.REDIS_ENABLED === 'true' && isFeatureEnabledInDesktop('DESKTOP_ENABLE_REDIS', false);
const backupEnabled = process.env.BACKUP_ENABLED === 'true';

export const config = {
  env: nodeEnv,
  runtime,
  desktopMode,
  auth: { allowRegistration: process.env.ALLOW_PUBLIC_REGISTRATION === 'true' && !desktopMode },
  port: parseInt(process.env.PORT || '5000', 10),
  // Prefer 127.0.0.1 over "localhost": on Windows, Node often binds ::1 only,
  // so curl/Vite health checks to 127.0.0.1:PORT get connection refused.
  host: process.env.HOST || '127.0.0.1',
  desktop: {
    dataDir: desktopDataDir,
    databaseUrl,
    // Quando definido, o backend serve o SPA (mesma origem => sem CORS/CSRF).
    frontendDir: desktopMode ? process.env.DESKTOP_FRONTEND_DIR || null : null,
    enableAi: aiEnabled,
    enableGoogleCalendar: googleCalendarEnabled,
    enableRedis: redisEnabled,
  },
  database: {
    url: databaseUrl,
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiration: process.env.JWT_EXPIRATION || '15m',
  },
  refresh: {
    ttlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '7', 10),
    cookieName: process.env.REFRESH_TOKEN_COOKIE || 'refresh_token',
  },
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  },
  cors: {
    origin: corsOrigins[0] || 'http://localhost:3000',
    origins: corsOrigins,
    /**
     * Aceita Origin/Referer http://{RFC1918|localhost|127.0.0.1}:porta além da
     * allowlist. Só development/test — staging/demo/prod falham se a flag estiver on.
     */
    allowPrivateLan: resolveAllowPrivateLan({
      env: nodeEnv,
      flagRequested: corsPrivateLanFlagRequested,
    }),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5', 10),
  },
  timeEntryLockDay: process.env.TIME_ENTRY_LOCK_DAY
    ? parseInt(process.env.TIME_ENTRY_LOCK_DAY, 10)
    : null,
  dailySeed: {
    enabled: process.env.DAILY_SEED_ENABLED === 'true' && process.env.ALLOW_DEMO_SEED === 'true' && !desktopMode,
    maxEntries: parseInt(process.env.DAILY_SEED_MAX_ENTRIES || '120', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  google: {
    enabled: googleCalendarEnabled,
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google-calendar/callback',
  },
  /** MCP OAuth protected-resource scaffolding — empty = not_configured (no fake IdP). */
  mcp: {
    oauth: {
      resourceUri: process.env.MCP_OAUTH_RESOURCE_URI || '',
      authorizationServers: process.env.MCP_OAUTH_AUTHORIZATION_SERVERS || '',
      scopesSupported: process.env.MCP_OAUTH_SCOPES || '',
      documentationUrl: process.env.MCP_OAUTH_DOCUMENTATION_URL || '',
    },
  },
  ai: {
    enabled: aiEnabled,
    provider: (process.env.AI_PROVIDER || 'openai') as 'openai' | 'gemini' | 'anthropic',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    gemini: {
      apiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
    },
    maxSuggestions: parseInt(process.env.AI_MAX_SUGGESTIONS || '5', 10),
    maxContextEntries: parseInt(process.env.AI_MAX_CONTEXT_ENTRIES || '20', 10),
    cacheTtlSeconds: parseInt(process.env.AI_CACHE_TTL_SECONDS || '300', 10),
    rateLimit: {
      windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '60000', 10),
      maxRequests: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS || '10', 10),
    },
  },
  redis: {
    enabled: redisEnabled,
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    cacheTtl: {
      dashboard: parseInt(process.env.REDIS_CACHE_TTL_DASHBOARD || '300', 10),
      lockStatus: parseInt(process.env.REDIS_CACHE_TTL_LOCK_STATUS || '60', 10),
    },
  },
  backup: {
    enabled: backupEnabled,
    schedule: process.env.BACKUP_SCHEDULE || '0 0 * * *',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
    providers: (process.env.BACKUP_PROVIDERS || 'local').split(',').map((p) => p.trim()) as Array<
      'local' | 'aws' | 'azure' | 'gcp'
    >,
    local: {
      path: process.env.BACKUP_LOCAL_PATH || './backups',
    },
    aws: {
      bucket: process.env.AWS_BACKUP_BUCKET || '',
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    azure: {
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
      containerName: process.env.AZURE_BACKUP_CONTAINER || 'backups',
    },
    gcp: {
      projectId: process.env.GCP_PROJECT_ID || '',
      bucket: process.env.GCP_BACKUP_BUCKET || '',
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    },
  },
};

export const validateConfig = (): void => {
  if (!config.database.url) {
    throw new Error('FATAL: DATABASE_URL environment variable is required');
  }
  if (!config.jwt.secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is required');
  }
  if (config.jwt.secret.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters for security');
  }
  const uniqueChars = new Set(config.jwt.secret).size;
  if (uniqueChars < 10) {
    throw new Error(
      'FATAL: JWT_SECRET has insufficient entropy - must contain at least 10 distinct characters'
    );
  }
  if (
    config.env === 'production' &&
    config.cors.origins.some((origin) => !origin.startsWith('https://')) &&
    !desktopMode
  ) {
    import('./shared/infrastructure/logger/logger.js').then(({ logger }) => {
      logger.warn('CORS_ORIGIN should use HTTPS in production');
    });
  }
  if (config.ai.enabled) {
    const provider = config.ai.provider;
    if (!['openai', 'gemini', 'anthropic'].includes(provider)) {
      throw new Error('FATAL: AI_PROVIDER must be openai, gemini, or anthropic');
    }
    const providerConfig = config.ai[provider];
    if (!providerConfig.apiKey) {
      const envVar =
        provider === 'openai'
          ? 'OPENAI_API_KEY'
          : provider === 'gemini'
            ? 'GOOGLE_GEMINI_API_KEY'
            : 'ANTHROPIC_API_KEY';
      throw new Error(`FATAL: ${envVar} is required when AI_SUGGESTIONS_ENABLED=true`);
    }
  }

  if (config.google.enabled) {
    if (!config.google.clientId || !config.google.clientSecret) {
      throw new Error(
        'FATAL: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required when Google Calendar is enabled'
      );
    }
  }

  if (config.backup.enabled) {
    const providers = config.backup.providers;
    const validProviders = ['local', 'aws', 'azure', 'gcp'];
    for (const provider of providers) {
      if (!validProviders.includes(provider)) {
        throw new Error(
          `FATAL: Invalid backup provider "${provider}". Must be one of: ${validProviders.join(', ')}`
        );
      }
      if (provider === 'aws' && (!config.backup.aws.bucket || !config.backup.aws.accessKeyId)) {
        throw new Error(
          'FATAL: AWS_BACKUP_BUCKET and AWS_ACCESS_KEY_ID are required when using AWS backup provider'
        );
      }
      if (provider === 'azure' && !config.backup.azure.connectionString) {
        throw new Error(
          'FATAL: AZURE_STORAGE_CONNECTION_STRING is required when using Azure backup provider'
        );
      }
      if (provider === 'gcp' && (!config.backup.gcp.bucket || !config.backup.gcp.projectId)) {
        throw new Error(
          'FATAL: GCP_BACKUP_BUCKET and GCP_PROJECT_ID are required when using GCP backup provider'
        );
      }
    }
  }
};
