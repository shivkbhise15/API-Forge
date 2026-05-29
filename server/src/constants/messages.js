/**
 * @file messages.js
 * @description Standard API response message strings.
 *
 * Centralizing response messages prevents:
 *   1. Inconsistent wording across endpoints
 *   2. Leaking internal implementation details in error messages
 *   3. Difficulty in updating messages (one place change)
 *
 * Security: Error messages are deliberately generic to avoid
 * information disclosure (e.g., "Invalid credentials" not "Wrong password").
 */

export const MESSAGES = Object.freeze({
  // ── Auth ──────────────────────────────────────────────────────────
  AUTH: {
    REGISTER_SUCCESS: 'Account created successfully. Please verify your email.',
    LOGIN_SUCCESS: 'Logged in successfully.',
    LOGOUT_SUCCESS: 'Logged out successfully.',
    TOKEN_REFRESHED: 'Access token refreshed.',
    EMAIL_VERIFIED: 'Email verified successfully.',
    VERIFY_EMAIL_SENT: 'Verification email sent. Check your inbox.',
    INVALID_CREDENTIALS: 'Invalid email or password.',
    EMAIL_NOT_VERIFIED: 'Please verify your email before logging in.',
    ACCOUNT_INACTIVE: 'Your account has been deactivated. Contact support.',
    TOKEN_INVALID: 'Invalid or expired token.',
    TOKEN_MISSING: 'Authentication token is required.',
    UNAUTHORIZED: 'You are not authorized to access this resource.',
    FORBIDDEN: 'You do not have permission to perform this action.',
    EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
    PASSWORD_RESET_SENT: 'Password reset link sent to your email.',
    PASSWORD_RESET_SUCCESS: 'Password reset successfully.',
  },

  // ── Projects ──────────────────────────────────────────────────────
  PROJECT: {
    CREATED: 'Project created successfully.',
    UPDATED: 'Project updated successfully.',
    DELETED: 'Project deleted successfully.',
    FETCHED: 'Projects retrieved successfully.',
    NOT_FOUND: 'Project not found.',
    DUPLICATE_NAME: 'A project with this name already exists.',
  },

  // ── API Keys ──────────────────────────────────────────────────────
  API_KEY: {
    CREATED: 'API key created successfully.',
    REVOKED: 'API key revoked successfully.',
    DELETED: 'API key deleted successfully.',
    FETCHED: 'API keys retrieved successfully.',
    NOT_FOUND: 'API key not found.',
    INVALID: 'Invalid or revoked API key.',
    EXPIRED: 'API key has expired.',
    RATE_LIMIT_EXCEEDED: 'API key rate limit exceeded.',
  },

  // ── Request Logs ──────────────────────────────────────────────────
  LOG: {
    FETCHED: 'Request logs retrieved successfully.',
    NOT_FOUND: 'No logs found for the specified criteria.',
    DELETED: 'Logs deleted successfully.',
  },

  // ── Analytics ─────────────────────────────────────────────────────
  ANALYTICS: {
    FETCHED: 'Analytics data retrieved successfully.',
  },

  // ── General ───────────────────────────────────────────────────────
  GENERAL: {
    NOT_FOUND: 'The requested resource was not found.',
    INTERNAL_ERROR: 'An unexpected error occurred. Please try again.',
    VALIDATION_ERROR: 'Validation failed. Check the errors array for details.',
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please slow down.',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Try again later.',
    HEALTH_OK: 'APIForge is running.',
  },
});
