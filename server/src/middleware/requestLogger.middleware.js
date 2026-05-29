/**
 * @file requestLogger.middleware.js
 * @description Async request logging middleware for API key authenticated routes.
 *
 * Architecture Decision — Non-Blocking Write:
 *   Request log writes are fire-and-forget (no await).
 *   The user's response is sent FIRST, then the log is written asynchronously.
 *   This ensures logging NEVER adds latency to the actual API response.
 *
 *   The trade-off: a crash immediately after sending the response could
 *   cause a missed log. This is acceptable — logs are analytics data,
 *   not transactional records. No financial or security decisions depend on 100%
 *   log completeness.
 *
 * Implementation:
 *   Uses response 'finish' event to capture the final status code and
 *   exact response time after headers are sent (most accurate measurement).
 *
 * Usage:
 *   Mount AFTER validateApiKey middleware (needs req.apiKey, req.projectId, req.userId).
 *   Can also be mounted on JWT-auth routes for management API logging.
 *
 * Future:
 *   Replace direct DB write with queue push (Bull job) for batch inserts.
 *   This reduces MongoDB write operations by up to 100x under high traffic.
 */

import { RequestLog } from '../models/RequestLog.model.js';
import { logger } from '../config/logger.js';

/**
 * Derive status category string from HTTP status code.
 * @param {number} statusCode
 * @returns {'2xx'|'3xx'|'4xx'|'5xx'}
 */
const getStatusCategory = (statusCode) => {
  if (statusCode < 300) return '2xx';
  if (statusCode < 400) return '3xx';
  if (statusCode < 500) return '4xx';
  return '5xx';
};

/**
 * Get client IP, handling reverse proxy headers.
 * @param {import('express').Request} req
 * @returns {string}
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.ip ||
    'unknown'
  );
};

/**
 * Middleware: log API request after response is sent.
 * Requires req.apiKey, req.projectId, req.userId to be populated.
 */
export const logRequest = (req, res, next) => {
  // Capture start time with high-resolution timer
  const startTime = process.hrtime.bigint();

  // Get request size from Content-Length header
  const requestSizeBytes = parseInt(req.headers['content-length'] || '0', 10);

  // Attach listener to the 'finish' event — fires after headers are sent
  res.on('finish', () => {
    // Skip logging if API key context is not present
    // (this middleware can be mounted globally; only log when key is validated)
    if (!req.apiKeyId || !req.projectId || !req.userId) return;

    const endTime = process.hrtime.bigint();
    const responseTimeMs = Number(endTime - startTime) / 1_000_000; // ns → ms

    const statusCode = res.statusCode;
    const responseSizeBytes = parseInt(res.getHeader('content-length') || '0', 10);

    // Fire-and-forget: do NOT await
    RequestLog.create({
      apiKeyId: req.apiKeyId,
      projectId: req.projectId,
      userId: req.userId,
      method: req.method,
      endpoint: req.originalUrl.substring(0, 2048), // cap URL length
      statusCode,
      responseTimeMs: Math.round(responseTimeMs * 100) / 100, // 2 decimal places
      requestSizeBytes,
      responseSizeBytes,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']?.substring(0, 512) || null,
      errorMessage: statusCode >= 400 ? res.locals.errorMessage || null : null,
      isSuccess: statusCode < 400,
      statusCategory: getStatusCategory(statusCode),
    }).catch((err) =>
      logger.error('[RequestLogger] Failed to write request log:', {
        error: err.message,
        path: req.originalUrl,
      }),
    );
  });

  next();
};
