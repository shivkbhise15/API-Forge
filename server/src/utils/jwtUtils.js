/**
 * @file jwtUtils.js
 * @description JWT token signing and verification utilities.
 *
 * Architecture Decision — Two-Token Strategy:
 *   Access Token (15min):
 *     - Short-lived, sent in Authorization header
 *     - Stateless — no DB lookup needed to verify
 *     - If leaked, expires quickly
 *
 *   Refresh Token (7 days):
 *     - Long-lived, stored as httpOnly cookie (not accessible to JS)
 *     - SHA-256 hash stored in DB — allows server-side revocation on logout
 *     - Used only to issue new access tokens
 *
 * Security:
 *   - Separate secrets for access/refresh tokens (one compromised ≠ both compromised)
 *   - Payload is minimal (userId, role only) — no PII in tokens
 *   - issuer/audience claims prevent token reuse across services
 *
 * Future:
 *   - Add Redis blacklist for immediate access token revocation
 *   - Support token rotation (issue new refresh token on each use)
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from './ApiError.js';
import { MESSAGES } from '../constants/messages.js';

const TOKEN_ISSUER = 'apiforge-api';
const TOKEN_AUDIENCE = 'apiforge-client';

/**
 * Sign a JWT access token.
 * @param {{ userId: string, role: string }} payload
 * @returns {string} signed JWT
 */
export const signAccessToken = (payload) => {
  return jwt.sign(
    { sub: payload.userId, role: payload.role },
    env.jwt.accessSecret,
    {
      expiresIn: env.jwt.accessExpiresIn,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    },
  );
};

/**
 * Sign a JWT refresh token.
 * @param {{ userId: string }} payload
 * @returns {string} signed JWT
 */
export const signRefreshToken = (payload) => {
  return jwt.sign(
    { sub: payload.userId },
    env.jwt.refreshSecret,
    {
      expiresIn: env.jwt.refreshExpiresIn,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    },
  );
};

/**
 * Verify and decode a JWT access token.
 * @param {string} token
 * @returns {{ userId: string, role: string }} decoded payload
 * @throws {UnauthorizedError} if token is invalid or expired
 */
export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret, {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    return { userId: decoded.sub, role: decoded.role };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Access token has expired. Please refresh.');
    }
    throw new UnauthorizedError(MESSAGES.AUTH.TOKEN_INVALID);
  }
};

/**
 * Verify and decode a JWT refresh token.
 * @param {string} token
 * @returns {{ userId: string }} decoded payload
 * @throws {UnauthorizedError}
 */
export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, env.jwt.refreshSecret, {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    return { userId: decoded.sub };
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token. Please log in again.');
  }
};
