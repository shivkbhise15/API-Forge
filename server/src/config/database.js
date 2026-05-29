/**
 * @file database.js
 * @description MongoDB connection manager with retry logic and graceful shutdown.
 *
 * Architecture Decisions:
 *   - Singleton pattern: connection is established once, reused across modules
 *   - Exponential backoff retry: prevents thundering herd on startup failures
 *   - Graceful shutdown hooks: ensures in-flight queries complete before exit
 *   - Connection pool configured for production load
 *
 * Scalability:
 *   - maxPoolSize: 10 handles concurrent requests without exhausting connections
 *   - serverSelectionTimeoutMS: fail fast if Atlas is unreachable
 *   - For read-heavy workloads, add a secondary read preference
 *
 * Future:
 *   - Add replica set event listeners for monitoring
 *   - Add connection metrics export to Prometheus
 */

import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 5;

/**
 * Establish MongoDB connection with exponential backoff retry.
 * @param {number} retryCount - current retry attempt
 */
const connectWithRetry = async (retryCount = 0) => {
  try {
    await mongoose.connect(env.mongodb.uri, {
      maxPoolSize: 10,             // max concurrent connections in pool
      serverSelectionTimeoutMS: 5000, // fail fast if no server found
      socketTimeoutMS: 45000,      // close sockets after 45s of inactivity
      family: 4,                   // use IPv4, skip IPv6 trials
    });

    logger.info('[DB] MongoDB connected successfully', {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
    });

    // ── Connection event listeners ───────────────────────────────────────
    mongoose.connection.on('disconnected', () => {
      logger.warn('[DB] MongoDB disconnected. Attempting reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('[DB] MongoDB reconnected.');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('[DB] MongoDB connection error:', { error: err.message });
    });

  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount); // exponential backoff
      logger.warn(
        `[DB] Connection failed. Retrying in ${delay / 1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`,
        { error: error.message },
      );
      await new Promise((res) => setTimeout(res, delay));
      return connectWithRetry(retryCount + 1);
    }

    logger.error('[DB] Max connection retries exceeded. Exiting.', {
      error: error.message,
    });
    process.exit(1);
  }
};

/**
 * Gracefully close the MongoDB connection.
 * Called on SIGTERM / SIGINT signals.
 */
export const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('[DB] MongoDB connection closed gracefully.');
  } catch (error) {
    logger.error('[DB] Error closing MongoDB connection:', {
      error: error.message,
    });
  }
};

export const connectDB = connectWithRetry;
