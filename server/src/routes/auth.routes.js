/**
 * @file auth.routes.js
 * @description Auth route definitions.
 *
 * Route Structure:
 *   POST   /auth/register          — create account
 *   POST   /auth/login             — login + get token pair
 *   POST   /auth/logout            — revoke session (requires auth)
 *   POST   /auth/refresh           — rotate tokens using httpOnly cookie
 *   GET    /auth/verify-email/:token — verify email from link
 *   POST   /auth/forgot-password   — request password reset
 *   POST   /auth/reset-password    — complete password reset
 *   GET    /auth/me                — get current user profile (requires auth)
 *   POST   /auth/dev/verify-email  — dev-only: manually verify account by email
 *
 * Rate Limiting:
 *   authRateLimiter is applied ONLY to login and register.
 *   /refresh, /me, /logout are NOT rate-limited at the auth level —
 *   they use the global IP limiter only, so session hydration and
 *   token refresh never fire the "too many attempts" error.
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authValidators } from '../validators/auth.validator.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// ── Public routes (with auth rate limiter on login + register only) ────────
router.post('/register', authRateLimiter, authValidators.register, validate, authController.register);
router.post('/login',    authRateLimiter, authValidators.login,    validate, authController.login);

// ── Public routes (NO auth rate limiter — must not burn the limit) ─────────
router.post('/refresh',  authController.refreshTokens);
router.get( '/verify-email/:token', authValidators.verifyEmail, validate, authController.verifyEmail);
router.post('/forgot-password', authValidators.forgotPassword,  validate, authController.forgotPassword);
router.post('/reset-password',  authValidators.resetPassword,   validate, authController.resetPassword);

// ── Protected routes ───────────────────────────────────────────────────────
router.post('/logout', authenticate, authController.logout);
router.get( '/me',     authenticate, authController.getMe);

// ── Dev-only utility route (never mounted in production) ───────────────────
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev/verify-email', authController.devVerifyEmail);
}

export default router;
