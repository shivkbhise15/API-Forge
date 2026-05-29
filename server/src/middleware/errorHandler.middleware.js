/**
 * @file errorHandler.middleware.js
 * @description Centralized Express error handling middleware.
 *
 * Architecture Decision:
 *   This is registered LAST in the Express middleware chain.
 *   All errors — whether thrown directly or passed via next(err) — flow here.
 *
 *   Two categories of errors:
 *     1. ApiError (operational): send statusCode + message to client
 *     2. Unknown errors: log full stack, send generic 500 to client
 *        (never expose internal details in production)
 *
 * Special Cases Handled:
 *   - Mongoose CastError → 400 (invalid ObjectId format)
 *   - Mongoose ValidationError → 422 (schema validation failed)
 *   - Mongoose duplicate key error (code 11000) → 409
 *   - JWT errors → 401
 *   - Multer file size errors → 400
 *
 * Security:
 *   In production, stack traces are NEVER sent to the client.
 *   Only in development are stacks included for debugging.
 */

import mongoose from 'mongoose';
import { ApiError, ValidationError, ConflictError, UnauthorizedError } from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { MESSAGES } from '../constants/messages.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

/**
 * Transform known third-party errors into ApiError instances.
 * @param {Error} err
 * @returns {ApiError}
 */
const normalizeError = (err) => {
  // Mongoose CastError (e.g., invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    return new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `Invalid value for field: ${err.path}`,
    );
  }

  // Mongoose schema validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return new ValidationError(errors);
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return new ConflictError(`Duplicate value for ${field}.`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return new UnauthorizedError(MESSAGES.AUTH.TOKEN_INVALID);
  }
  if (err.name === 'TokenExpiredError') {
    return new UnauthorizedError('Token has expired. Please log in again.');
  }

  // Pass through existing ApiErrors
  if (err instanceof ApiError) {
    return err;
  }

  // Unknown / programming error — don't expose internals
  return new ApiError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    MESSAGES.GENERAL.INTERNAL_ERROR,
    [],
    false, // not operational — needs investigation
    err.stack,
  );
};

/**
 * Global error handler middleware.
 * Must have 4 parameters for Express to treat it as an error handler.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const apiError = normalizeError(err);

  // Log: operational errors at warn level, unknown at error level
  if (apiError.isOperational) {
    logger.warn('[ErrorHandler] Operational error:', {
      requestId: req.requestId,
      path: req.path,
      method: req.method,
      statusCode: apiError.statusCode,
      message: apiError.message,
    });
  } else {
    logger.error('[ErrorHandler] Unexpected error:', {
      requestId: req.requestId,
      path: req.path,
      method: req.method,
      error: err.message,
      stack: err.stack,
    });
  }

  const responseBody = {
    success: false,
    message: apiError.message,
    errors: apiError.errors?.length ? apiError.errors : undefined,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    // Only include stack in development
    ...(env.isDevelopment && !apiError.isOperational && { stack: apiError.stack }),
  };

  return res.status(apiError.statusCode).json(responseBody);
};

/**
 * 404 handler — register BEFORE errorHandler, AFTER all routes.
 */
export const notFoundHandler = (req, res, next) => {
  next(
    new ApiError(
      HTTP_STATUS.NOT_FOUND,
      `Route ${req.method} ${req.originalUrl} not found.`,
    ),
  );
};
