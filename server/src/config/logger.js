/**
 * @file logger.js
 * @description Winston logger factory with environment-aware transports.
 *
 * Architecture Decisions:
 *   - Development: colorized console output with full metadata
 *   - Production: JSON structured logs to rotating daily files
 *     (machine-parseable for log aggregators like Datadog, CloudWatch)
 *   - Separate error.log for fast error triage
 *   - winston-daily-rotate-file prevents single large log files
 *
 * Security:
 *   - Logs are written to /logs — excluded from git via .gitignore
 *   - No sensitive data (passwords, tokens) should ever be passed to logger
 *
 * Future:
 *   - Add a transport for external log aggregation (e.g., Logtail, Datadog)
 *   - Add child loggers per module: logger.child({ module: 'AuthService' })
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, '../../logs');

// ── Custom log format for development ─────────────────────────────────────
const devFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? `\n${JSON.stringify(meta, null, 2)}`
      : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }),
);

// ── Structured JSON format for production ─────────────────────────────────
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }), // include stack traces in logs
  winston.format.json(),
);

// ── Rotating file transport (production) ──────────────────────────────────
const createRotatingTransport = (level, filename) =>
  new DailyRotateFile({
    level,
    dirname: LOG_DIR,
    filename: `${filename}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',     // rotate when file exceeds 20MB
    maxFiles: '30d',    // keep logs for 30 days
    zippedArchive: true,
  });

// ── Logger factory ────────────────────────────────────────────────────────
const createLogger = () => {
  const transports = [];

  if (env.isDevelopment || env.isTest) {
    transports.push(new winston.transports.Console({ format: devFormat }));
  } else {
    // Production: structured JSON to rotating files
    transports.push(
      new winston.transports.Console({ format: prodFormat }),
      createRotatingTransport('info', 'combined'),
      createRotatingTransport('error', 'error'),
    );
  }

  return winston.createLogger({
    level: env.isDevelopment ? 'debug' : 'info',
    format: prodFormat,
    transports,
    // Prevents Winston from crashing the process on transport error
    exitOnError: false,
  });
};

export const logger = createLogger();

// ── Stream for Morgan HTTP request logging integration ────────────────────
export const morganStream = {
  write: (message) => logger.http(message.trim()),
};
