/**
 * @file ApiError.js
 * @description Custom error class hierarchy for structured error handling.
 *
 * Architecture Decision:
 *   Extending the native Error class with operational context allows the
 *   centralized error handler to distinguish between:
 *     1. Operational errors (ApiError) — known, expected, return 4xx/5xx
 *     2. Programming errors (unhandled) — unknown, log + return 500
 *
 *   The `isOperational` flag is the key distinction. In production, only
 *   operational error messages are sent to the client; all others return
 *   a generic "internal error" message to prevent info leakage.
 *
 * Scalability:
 *   Specific subclasses (ValidationError, NotFoundError, etc.) allow
 *   middleware to pattern-match error types without string comparison.
 */

export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - error message (sent to client)
   * @param {Array} errors - array of field-level validation errors
   * @param {boolean} isOperational - true = known/expected error
   * @param {string} stack - override stack trace
   */
  constructor(
    statusCode,
    message,
    errors = [],
    isOperational = true,
    stack = '',
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ── Specialized subclasses ────────────────────────────────────────────────

export class ValidationError extends ApiError {
  constructor(errors = [], message = 'Validation failed') {
    super(422, message, errors);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource already exists') {
    super(409, message);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = 'Too many requests') {
    super(429, message);
    this.name = 'TooManyRequestsError';
  }
}
