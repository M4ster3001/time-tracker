import path from 'path';
import express, { type Express, type RequestHandler } from 'express';
import { config, validateConfig } from '../../config.js';
import { connectDatabase } from '../../shared/infrastructure/db/prisma.js';
import { logger } from '../../shared/infrastructure/logger/logger.js';
import { logActiveFeatures, runBootDiagnostics } from './diagnostics.js';
import { startBackgroundJobs } from './jobs.js';
import { applySecurityMiddleware } from './security.js';
import { registerRoutes } from './routes.js';
import { notFoundMiddleware } from '../http/middleware/not-found.middleware.js';
import { errorHandlerMiddleware } from '../http/middleware/error-handler.middleware.js';

export const createApp = (): Express => {
  validateConfig();

  const app = express();
  applySecurityMiddleware(app);
  registerRoutes(app);
  serveDesktopFrontend(app);
  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
};

/**
 * No runtime desktop o SPA e servido pelo proprio backend local. Assim a janela
 * do Electron carrega http://127.0.0.1:PORT (mesma origem da API), evitando os
 * bloqueios de CORS/CSRF que ocorrem quando a pagina roda em file://.
 */
const serveDesktopFrontend = (app: Express): void => {
  const frontendDir = config.desktop.frontendDir;
  if (!config.desktopMode || !frontendDir) return;

  // Cast: ha duas versoes de @types/express no monorepo e o retorno de
  // express.static resolve para um RequestHandler de outra copia dos tipos.
  app.use(express.static(frontendDir) as unknown as RequestHandler);
  // Fallback do SPA: qualquer GET que nao seja API/health devolve o index.html.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/health')) {
      next();
      return;
    }
    res.sendFile(path.join(frontendDir, 'index.html'));
  });

  logger.info(`[BOOT] Desktop frontend served from ${frontendDir}`);
};

export const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();

    if (config.desktopMode) {
      // Bancos SQLite de instalacoes anteriores a fundacao do sync nao tem as
      // colunas novas (uuid/deletedAt); PRAGMA e sintaxe SQLite, entao isso so
      // pode rodar em modo desktop.
      const { runDesktopSchemaUpgrades } = await import(
        '../../modules/sync/application/desktop-schema-upgrade.js'
      );
      await runDesktopSchemaUpgrades();
    }

    await runBootDiagnostics();

    const app = createApp();
    app.listen(config.port, config.host, async () => {
      logger.info(`Server running on http://${config.host}:${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logActiveFeatures();
      await startBackgroundJobs();
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};
