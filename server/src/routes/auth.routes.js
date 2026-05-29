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
 * Middleware chain per route:
 *   validators → validate (throws on failure) → controller
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authValidators } from '../validators/auth.validator.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Public routes
router.post('/register',         authValidators.register,        validate, authController.register);
router.post('/login',            authValidators.login,           validate, authController.login);
router.post('/refresh',          authController.refreshTokens);
router.get('/verify-email/:token', authValidators.verifyEmail,  validate, authController.verifyEmail);
router.post('/forgot-password',  authValidators.forgotPassword,  validate, authController.forgotPassword);
router.post('/reset-password',   authValidators.resetPassword,   validate, authController.resetPassword);

// Dev-only routes
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev/verify-email', authController.devVerifyEmail);
}

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me',      authenticate, authController.getMe);

export default router;
