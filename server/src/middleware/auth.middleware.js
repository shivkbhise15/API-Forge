/**
 * @file auth.middleware.js
 * @description JWT authentication + RBAC middleware.
 *
 * Design:
 *   `authenticate` — verifies the Bearer token, attaches { userId, role }
 *     to req.user. Throws UnauthorizedError if token is missing/invalid.
 *
 *   `authorize(...roles)` — factory that returns a middleware checking
 *     req.user.role against an allowed roles list.
 *     Must be used AFTER `authenticate`.
 *
 * Security:
 *   - Token is extracted only from Authorization header (not query params)
 *     to prevent token leakage in server access logs.
 *   - Role check is always server-side; frontend role is never trusted.
 *
 * Usage:
 *   router.delete('/users/:id', authenticate, authorize(ROLES.ADMIN), controller);
 */

import { verifyAccessToken } from '../utils/jwtUtils.js';
import { UnauthorizedError, ForbiddenError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';

/**
 * Middleware: verify JWT access token.
 * Attaches decoded payload to req.user.
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError(MESSAGES.AUTH.TOKEN_MISSING);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError(MESSAGES.AUTH.TOKEN_MISSING);
    }

    // verifyAccessToken throws UnauthorizedError on failure
    const decoded = verifyAccessToken(token);
    req.user = decoded; // { userId, role }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware factory: check that authenticated user has one of the allowed roles.
 * @param {...string} allowedRoles - roles permitted to access this route
 * @returns {function} Express middleware
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError(MESSAGES.AUTH.UNAUTHORIZED));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(MESSAGES.AUTH.FORBIDDEN));
    }

    next();
  };
};
