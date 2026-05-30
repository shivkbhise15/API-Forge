/**
 * @file rateLimiter.middleware.js
 * @description Redis-backed rate limiting middleware.
 *
 * Three tiers of rate limiting:
 *
 *   [1] globalRateLimiter — IP-based, 100 req / 15 min per IP on all routes
 *
 *   [2] authRateLimiter — Applied ONLY to login + register routes.
 *       NOT applied to /refresh, /me, /logout — session hydration and token
 *       refresh must never trigger "too many attempts".
 *       dev: 100/15min  |  production: 20/15min
 *
 *   [3] apiKeyRateLimiter — Per-API-key sliding window (Redis INCR + EXPIRE).
 *       Must come after validateApiKey middleware.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getRedisClient } from '../config/redis.js';
import { env } from '../config/env.js';
import { TooManyRequestsError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { logger } from '../config/logger.js';

// ── IP extractor that strips IPv4-mapped IPv6 prefix ─────────────────────
// express-rate-limit's ipKeyGenerator rejects "::ffff:127.0.0.1" (ERR_ERL_KEY_GEN_IPV6).
// Stripping "::ffff:" converts it to a plain IPv4 address that passes validation.
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = forwarded
    ? forwarded.split(',')[0].trim()
    : (req.ip || req.socket?.remoteAddress || '127.0.0.1');

  // Strip IPv4-mapped IPv6 prefix so ipKeyGenerator receives a valid address
  const normalized = raw.replace(/^::ffff:/i, '');
  return ipKeyGenerator(normalized);
};

// ── Standard 429 response ─────────────────────────────────────────────────
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success:   false,
    message:   MESSAGES.GENERAL.RATE_LIMIT_EXCEEDED,
    retryAfter: 900, // 15 min in seconds
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
};

// ── [1] Global IP-based rate limiter ─────────────────────────────────────
export const globalRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max:      env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  handler: rateLimitHandler,
  skip: (req) => req.path === '/health',
});

// ── [2] Auth-specific rate limiter (login + register only) ────────────────
const AUTH_RATE_LIMIT_MAX = env.isDevelopment ? 100 : 20;

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  handler: (req, res) => {
    res.status(429).json({
      success:    false,
      message:    'Too many attempts. Please wait 15 minutes before trying again.',
      retryAfter: 900,
      requestId:  req.requestId,
      timestamp:  new Date().toISOString(),
    });
  },
});

// ── [3] Per-API-Key sliding window rate limiter ───────────────────────────
export const apiKeyRateLimiter = async (req, res, next) => {
  if (!req.apiKey || !req.apiKeyId) return next();

  const redis = getRedisClient();
  if (!redis) {
    logger.warn('[RateLimiter] Redis unavailable — skipping per-key rate limit.');
    return next();
  }

  try {
    const limitPerMin   = req.apiKey.rateLimit?.requestsPerMin || 60;
    const currentMinute = Math.floor(Date.now() / 60000);
    const redisKey      = `ratelimit:key:${req.apiKeyId}:${currentMinute}`;

    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, 61);

    res.setHeader('X-RateLimit-Limit',     limitPerMin);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limitPerMin - count));
    res.setHeader('X-RateLimit-Reset',     (currentMinute + 1) * 60);

    if (count > limitPerMin) {
      return next(new TooManyRequestsError(MESSAGES.API_KEY.RATE_LIMIT_EXCEEDED));
    }

    next();
  } catch (error) {
    logger.error('[RateLimiter] Redis error during per-key rate limit check:', {
      error: error.message,
      keyId: req.apiKeyId,
    });
    next(); // fail open
  }
};
