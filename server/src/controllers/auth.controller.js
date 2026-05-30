/**
 * @file auth.controller.js
 * @description Auth route handlers — thin controllers.
 *
 * Controller Responsibility:
 *   1. Parse and extract request data
 *   2. Call the service layer
 *   3. Send the standardized response
 *
 * Controllers must NEVER contain business logic.
 * They should always be <30 lines per handler.
 *
 * Cookie Strategy (Refresh Token):
 *   Refresh token is set as httpOnly, Secure, SameSite=Strict cookie.
 *   This prevents XSS attacks from stealing the refresh token via JS.
 *   The access token is returned in the JSON body (stored in memory on client).
 */

import { authService } from '../services/auth.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { env } from '../config/env.js';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,                            // JS cannot read this cookie (XSS safe)
  secure:   env.httpsOnly,                  // true only when HTTPS_ONLY=true in .env
  sameSite: env.httpsOnly ? 'strict' : 'lax', // lax allows email-link redirects
  maxAge:   7 * 24 * 60 * 60 * 1000,       // 7 days in ms
  path:     '/api/v1/auth/refresh',         // scoped to refresh endpoint only
};

export const authController = {
  /**
   * POST /api/v1/auth/register
   */
  register: async (req, res, next) => {
    try {
      const { firstName, lastName, email, password } = req.body;
      const { user } = await authService.register({ firstName, lastName, email, password });

      return new ApiResponse(
        HTTP_STATUS.CREATED,
        MESSAGES.AUTH.REGISTER_SUCCESS,
        { user },
        null,
        req.requestId,
      ).send(res, HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/login
   */
  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const { user, accessToken, refreshToken } = await authService.login({ email, password });

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

      return new ApiResponse(
        HTTP_STATUS.OK,
        MESSAGES.AUTH.LOGIN_SUCCESS,
        { user, accessToken },
        null,
        req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/refresh
   */
  refreshTokens: async (req, res, next) => {
    try {
      const rawRefreshToken = req.cookies?.refreshToken;
      if (!rawRefreshToken) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Refresh token not found.',
        });
      }

      const { accessToken, refreshToken } = await authService.refreshTokens(rawRefreshToken);

      res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

      return new ApiResponse(
        HTTP_STATUS.OK,
        MESSAGES.AUTH.TOKEN_REFRESHED,
        { accessToken },
        null,
        req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/logout
   */
  logout: async (req, res, next) => {
    try {
      await authService.logout(req.user.userId);
      res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });

      return new ApiResponse(
        HTTP_STATUS.OK,
        MESSAGES.AUTH.LOGOUT_SUCCESS,
        null,
        null,
        req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/auth/verify-email/:token
   */
  verifyEmail: async (req, res, next) => {
    try {
      await authService.verifyEmail(req.params.token);

      return new ApiResponse(
        HTTP_STATUS.OK,
        MESSAGES.AUTH.EMAIL_VERIFIED,
        null,
        null,
        req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/forgot-password
   */
  forgotPassword: async (req, res, next) => {
    try {
      await authService.forgotPassword(req.body.email);

      // Always return 200 regardless of whether email exists
      return new ApiResponse(
        HTTP_STATUS.OK,
        MESSAGES.AUTH.PASSWORD_RESET_SENT,
        null,
        null,
        req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/reset-password
   */
  resetPassword: async (req, res, next) => {
    try {
      const { token, password } = req.body;
      await authService.resetPassword(token, password);

      return new ApiResponse(
        HTTP_STATUS.OK,
        MESSAGES.AUTH.PASSWORD_RESET_SUCCESS,
        null,
        null,
        req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/auth/me
   * Returns the authenticated user's profile.
   */
  getMe: async (req, res, next) => {
    try {
      const { User } = await import('../models/User.model.js');
      const user = await User.findById(req.user.userId);

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'User not found.',
        });
      }

      return new ApiResponse(
        HTTP_STATUS.OK,
        'Profile retrieved.',
        { user },
        null,
        req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/dev/verify-email  { email }
   * Dev-only: manually mark an account as email-verified.
   * Gate is enforced at the route level (never mounted in production).
   */
  devVerifyEmail: async (req, res, next) => {
    try {
      const { User } = await import('../models/User.model.js');
      const { email } = req.body;
      if (!email) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'email is required' });
      }
      const user = await User.findOneAndUpdate(
        { email },
        { isEmailVerified: true, emailVerificationToken: null, emailVerificationExpires: null },
        { new: true },
      );
      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'User not found' });
      }
      return res.json({ success: true, message: `✓ Email verified for ${email}`, userId: user._id });
    } catch (error) {
      next(error);
    }
  },
};
