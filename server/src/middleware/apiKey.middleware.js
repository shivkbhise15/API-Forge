/**
 * @file apiKey.middleware.js
 * @description API Key authentication middleware.
 *
 * This middleware is used on routes that accept requests authenticated
 * via API key (as opposed to JWT). These are typically "proxy" routes
 * where an external developer is making requests on behalf of their app.
 *
 * Header: X-API-Key: ak_{prefix}_{suffix}
 *
 * After validation, attaches to req:
 *   req.apiKey    — the validated ApiKey document
 *   req.project   — the associated Project document
 *   req.apiKeyId  — string ID (for logging)
 *
 * The middleware also fires usage tracking asynchronously (non-blocking).
 *
 * Future:
 *   Cache validated keys in Redis (LRU cache, 5-min TTL) to eliminate
 *   DB lookups on every request. This is the single biggest performance
 *   lever for high-traffic deployments.
 */

import { apiKeyService } from '../services/apiKey.service.js';
import { ApiError } from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { MESSAGES } from '../constants/messages.js';

/**
 * Middleware: extract and validate API key from X-API-Key header.
 */
export const validateApiKey = async (req, res, next) => {
  try {
    const rawKey = req.headers['x-api-key'];

    if (!rawKey) {
      throw new ApiError(
        HTTP_STATUS.UNAUTHORIZED,
        'API key required. Include X-API-Key header.',
      );
    }

    if (!rawKey.startsWith('ak_')) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.API_KEY.INVALID);
    }

    // Validate key — throws on invalid/expired/revoked
    const { apiKey, project } = await apiKeyService.validateKey(rawKey);

    // Attach to request for downstream use
    req.apiKey = apiKey;
    req.project = project;
    req.apiKeyId = apiKey._id.toString();
    req.projectId = project._id.toString();
    req.userId = apiKey.userId.toString();

    // Track usage asynchronously — don't block the response
    apiKeyService.trackUsage(apiKey._id);

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware factory: check that the validated API key has a required scope.
 * Must be used AFTER validateApiKey.
 *
 * @param {string} requiredScope - e.g., 'write', 'admin'
 * @example
 *   router.post('/data', validateApiKey, requireScope('write'), controller);
 */
export const requireScope = (requiredScope) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return next(
        new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.API_KEY.INVALID),
      );
    }

    if (!req.apiKey.scopes?.includes(requiredScope)) {
      return next(
        new ApiError(
          HTTP_STATUS.FORBIDDEN,
          `This API key does not have the '${requiredScope}' scope.`,
        ),
      );
    }

    next();
  };
};
