/**
 * @file redis.js
 * @description Upstash Redis client using @upstash/redis REST client.
 *
 * Architecture Decision:
 *   Using Upstash's REST-based Redis client (not ioredis) because Upstash
 *   provides a serverless-compatible HTTP REST API — no persistent TCP
 *   connection required. This works on Render/Railway/Vercel without
 *   needing a Redis TCP port open.
 *
 * Usage:
 *   - Rate limiting (sliding window counters)
 *   - JWT refresh token blacklist
 *   - API key validation cache (LRU-style TTL caching)
 *   - Analytics pre-computation cache
 *
 * Future:
 *   - Swap to ioredis for self-hosted Redis with minimal code change
 *   - Add Redis pub/sub for real-time Socket.io events
 */

import { Redis } from '@upstash/redis';
import { env } from './env.js';
import { logger } from './logger.js';

let redisClient = null;

/**
 * Initialize and return the Upstash Redis client (singleton).
 * @returns {Redis} redis client instance
 */
export const getRedisClient = () => {
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis({
      url: env.redis.url,
      token: env.redis.token,
    });

    logger.info('[Redis] Upstash Redis client initialized.');
    return redisClient;
  } catch (error) {
    logger.error('[Redis] Failed to initialize Redis client:', {
      error: error.message,
    });
    // Non-fatal: app continues without Redis, rate limiting falls back to memory
    return null;
  }
};

/**
 * Ping Redis to validate connectivity.
 * Called at startup for health verification.
 */
export const pingRedis = async () => {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const pong = await client.ping();
    logger.info('[Redis] Connection verified:', { response: pong });
    return true;
  } catch (error) {
    logger.warn('[Redis] Ping failed — Redis may be unavailable:', {
      error: error.message,
    });
    return false;
  }
};
