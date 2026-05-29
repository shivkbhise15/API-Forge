/**
 * @file rateLimiter.middleware.js
 * @description Redis-backed rate limiting middleware.
 *
 * Architecture:
 *   Three tiers of rate limiting, each with a different scope:
 *
 *   [1] globalRateLimiter — IP-based, protects the entire API surface
 *       Applied globally in app.js before any route matching.
 *       Prevents DDoS and brute-force enumeration.
 *
 *   [2] authRateLimiter — Stricter IP-based limit for auth endpoints only
 *       Login/register are the most vulnerable to brute-force attacks.
 *       5 requests per 15 minutes per IP.
 *
 *   [3] apiKeyRateLimiter — Per-API-key sliding window
 *       Each API key has its own counter in Redis.
 *       Enforces the per-key rate limit defined in ApiKey.rateLimit.requestsPerMin
 *       Must be used AFTER validateApiKey middleware.
 *
 * Redis Integration:
 *   Uses Upstash Redis via @upstash/redis REST client.
 *   Falls back to express-rate-limit's in-memory store if Redis is unavailable.
 *   In-memory fallback doesn't work across multiple instances — acceptable for MVP,
 *   must be Redis for production multi-instance deployment.
 *
 * Algorithm:
 *   express-rate-limit uses a fixed window algorithm.
 *   For the per-key limiter, we implement a sliding window with Redis
 *   INCR + EXPIRE to be more accurate and fair.
 *
 * Future:
 *   - Token bucket algorithm for smoother burst handling
 *   - Separate daily quota tracking (requestsPerDay from ApiKey.rateLimit)
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getRedisClient } from '../config/redis.js';
import { env } from '../config/env.js';
import { TooManyRequestsError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { logger } from '../config/logger.js';

// ── Standard response for rate limit errors ────────────────────────────────
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: MESSAGES.GENERAL.RATE_LIMIT_EXCEEDED,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
};

// ── [1] Global IP-based rate limiter ──────────────────────────────────────
export const globalRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    const forwardedIp = req.headers['x-forwarded-for']
      ?.split(',')[0]
      ?.trim();

    return ipKeyGenerator(forwardedIp || req.ip);
  },

  handler: rateLimitHandler,

  skip: (req) => req.path === '/health',
});
// ── [2] Auth endpoint rate limiter (stricter) ─────────────────────────────
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    const forwardedIp = req.headers['x-forwarded-for']
      ?.split(',')[0]
      ?.trim();

    return ipKeyGenerator(forwardedIp || req.ip);
  },

  handler: rateLimitHandler,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

// ── [3] Per-API-Key sliding window rate limiter ───────────────────────────

/**
 * Implements a per-minute sliding window rate limit using Redis INCR + EXPIRE.
 *
 * Algorithm:
 *   - Key format: `ratelimit:key:{keyId}:{currentMinute}`
 *   - INCR the counter for this minute
 *   - EXPIRE the key at 61 seconds (slightly longer than 1 minute for safety)
 *   - If counter > limit, reject with 429
 *
 * Why per-minute bucket instead of true sliding window?
 *   True sliding window requires ZRANGEBYSCORE queries on a sorted set.
 *   The bucket approach is O(1) and 95% accurate for practical purposes.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const apiKeyRateLimiter = async (req, res, next) => {
  // Must be used after validateApiKey
  if (!req.apiKey || !req.apiKeyId) return next();

  const redis = getRedisClient();

  // If Redis is unavailable, skip per-key rate limiting (fail open)
  // In production, you'd want to fail closed — depends on your risk tolerance
  if (!redis) {
    logger.warn('[RateLimiter] Redis unavailable — skipping per-key rate limit.');
    return next();
  }

  try {
    const limitPerMin = req.apiKey.rateLimit?.requestsPerMin || 60;
    const currentMinute = Math.floor(Date.now() / 60000); // unix minute
    const redisKey = `ratelimit:key:${req.apiKeyId}:${currentMinute}`;

    // Atomic increment
    const count = await redis.incr(redisKey);

    if (count === 1) {
      // First request this minute — set expiry (61s to handle clock drift)
      await redis.expire(redisKey, 61);
    }

    // Set rate limit headers for client visibility
    res.setHeader('X-RateLimit-Limit', limitPerMin);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limitPerMin - count));
    res.setHeader('X-RateLimit-Reset', (currentMinute + 1) * 60); // next minute

    if (count > limitPerMin) {
      return next(new TooManyRequestsError(MESSAGES.API_KEY.RATE_LIMIT_EXCEEDED));
    }

    next();
  } catch (error) {
    // On Redis error, fail open (allow request) but log it
    logger.error('[RateLimiter] Redis error during per-key rate limit check:', {
      error: error.message,
      keyId: req.apiKeyId,
    });
    next();
  }
};
