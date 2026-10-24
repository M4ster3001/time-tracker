import pino from 'pino';
import { createRequire } from 'node:module';
import { config } from '../../../config.js';

const isDev = config.env === 'development' || config.env === 'test';
const require = createRequire(import.meta.url);

const resolvePrettyTransport = ():
  | { target: string; options: Record<string, unknown> }
  | undefined => {
  if (!isDev) return undefined;
  try {
    require.resolve('pino-pretty');
    return {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    };
  } catch {
    return undefined;
  }
};

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: resolvePrettyTransport(),
});
