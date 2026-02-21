import pino from 'pino';
import { loadConfig } from './index.js';

let logger: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (logger) return logger;

  const config = loadConfig();

  logger = pino({
    level: config.LOG_LEVEL,
    transport: config.NODE_ENV === 'development'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  return logger;
}
