/**
 * @file server.js
 * @description HTTP server entry point.
 *
 * Architecture Decision:
 *   server.js is intentionally minimal — it only:
 *     1. Boots the database
 *     2. Verifies Redis connectivity
 *     3. Creates the Express app
 *     4. Starts the HTTP server
 *     5. Registers graceful shutdown handlers
 *
 *   All Express configuration lives in app.js.
 *   All DB configuration lives in config/database.js.
 *   This separation makes testing and debugging much cleaner.
 *
 * Graceful Shutdown:
 *   On SIGTERM (Docker stop, Render redeploy), we:
 *     1. Stop accepting new connections
 *     2. Allow in-flight requests to complete (timeout: 10s)
 *     3. Close DB connection
 *     4. Exit cleanly
 *   This prevents dropped requests during deployments.
 *
 * Process Error Handlers:
 *   unhandledRejection and uncaughtException are caught globally.
 *   In production, these trigger graceful shutdown.
 *   In development, they log and continue (for easier debugging).
 */

import { createApp } from './src/app.js';
import { connectDB, disconnectDB } from './src/config/database.js';
import { pingRedis } from './src/config/redis.js';
import { startAnalyticsJobs } from './src/jobs/analyticsAggregation.job.js';
import { logger } from './src/config/logger.js';
import { env } from './src/config/env.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

let server;

/**
 * Bootstrap the application.
 */
const bootstrap = async () => {
  // ── 1. Connect to MongoDB ───────────────────────────────────────────────
  await connectDB();

  // ── 2. Verify Redis ─────────────────────────────────────────────────────
  await pingRedis();

  // ── 3. Start background jobs ────────────────────────────────────────────
  if (!env.isTest) startAnalyticsJobs();

  // ── 4. Create Express app ───────────────────────────────────────────────
  const app = createApp();

  // ── 4. Start HTTP server ────────────────────────────────────────────────
  server = app.listen(env.port, () => {
    logger.info(`[Server] APIForge is running`, {
      port: env.port,
      environment: env.nodeEnv,
      pid: process.pid,
    });
  });

  // Handle server-level errors (e.g., EADDRINUSE)
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`[Server] Port ${env.port} is already in use.`);
    } else {
      logger.error('[Server] Server error:', { error: error.message });
    }
    process.exit(1);
  });
};

/**
 * Graceful shutdown handler.
 * @param {string} signal - the OS signal received
 */
const gracefulShutdown = async (signal) => {
  logger.info(`[Server] ${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(async () => {
      logger.info('[Server] HTTP server closed. Cleaning up...');

      try {
        await disconnectDB();
        logger.info('[Server] Shutdown complete. Exiting.');
        process.exit(0);
      } catch (error) {
        logger.error('[Server] Error during shutdown:', { error: error.message });
        process.exit(1);
      }
    });

    // Force shutdown if graceful close takes too long
    setTimeout(() => {
      logger.error('[Server] Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
  } else {
    process.exit(0);
  }
};

// ── Process Signal Handlers ─────────────────────────────────────────────────
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ── Unhandled Promise Rejections ────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Process] Unhandled Promise Rejection:', {
    reason: reason?.message || reason,
    promise,
  });
  if (env.isProduction) gracefulShutdown('unhandledRejection');
});

// ── Uncaught Exceptions ─────────────────────────────────────────────────────
process.on('uncaughtException', (error) => {
  logger.error('[Process] Uncaught Exception — process will exit:', {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown('uncaughtException');
});

// ── Boot ────────────────────────────────────────────────────────────────────
bootstrap().catch((error) => {
  logger.error('[Bootstrap] Fatal error during startup:', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
