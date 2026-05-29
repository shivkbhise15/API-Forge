/**
 * @file auth.service.js
 * @description Authentication business logic — the service layer.
 *
 * Architecture — Service Layer Pattern:
 *   Controllers are thin: they parse requests and send responses.
 *   All business logic lives in services. This means:
 *     1. Services are independently unit-testable (no HTTP context needed)
 *     2. Services can be reused across different controllers/routes
 *     3. Controllers stay readable (<30 lines each)
 *
 * Responsibility of this service:
 *   - User registration + email verification token generation
 *   - Login with brute-force protection
 *   - JWT token pair issuance
 *   - Refresh token rotation
 *   - Logout (token revocation)
 *   - Email verification confirmation
 *   - Password reset flow
 */

import nodemailer from 'nodemailer';
import { User } from '../models/User.model.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwtUtils.js';
import {
  generateSecureToken,
  hashToken,
  timingSafeCompare,
} from '../utils/cryptoUtils.js';
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ApiError,
} from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour

// ── Nodemailer transporter (singleton) ────────────────────────────────────
const createTransporter = () =>
  nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.port === 465, // true for 465, false for other ports
    auth: {
      user: env.email.user,
      pass: env.email.pass,
    },
  });

class AuthService {
  /**
   * Register a new user.
   * Generates email verification token and sends verification email.
   *
   * @param {{ firstName, lastName, email, password }} dto
   * @returns {{ user }} - user object (no sensitive fields)
   */
  async register({ firstName, lastName, email, password }) {
    // Check duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      throw new ConflictError(MESSAGES.AUTH.EMAIL_ALREADY_EXISTS);
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // In development: auto-verify email so we can test login without SMTP
    const isDev = env.isDevelopment;

    // Generate email verification token (still created even in dev, for consistency)
    const rawToken = generateSecureToken(32);
    const emailVerificationToken = isDev ? null : hashToken(rawToken);
    const emailVerificationExpires = isDev ? null : new Date(
      Date.now() + env.email.verifyTokenExpiresHours * 60 * 60 * 1000,
    );

    // Create user — auto-verified in dev
    const user = await User.create({
      firstName,
      lastName,
      email,
      passwordHash,
      emailVerificationToken,
      emailVerificationExpires,
      isEmailVerified: isDev, // ← auto-verify in development
    });

    if (!isDev) {
      // Send verification email (non-blocking — failure never breaks registration)
      this.sendVerificationEmail(user.email, user.firstName, rawToken).catch(
        (err) => logger.error('[AuthService] Failed to send verification email:', { error: err.message }),
      );
    } else {
      logger.info('[AuthService] DEV MODE — email auto-verified, skipping SMTP:', { email });
    }

    logger.info('[AuthService] User registered:', { userId: user._id, email, autoVerified: isDev });

    return { user };
  }

  /**
   * Login a user.
   * Enforces brute-force protection, issues JWT pair.
   *
   * @param {{ email, password }} dto
   * @returns {{ user, accessToken, refreshToken }}
   */
  async login({ email, password }) {
    // Select sensitive fields explicitly (they have select: false)
    const user = await User.findOne({ email }).select(
      '+passwordHash +loginAttempts +lockUntil',
    );

    if (!user) {
      throw new UnauthorizedError(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    // Check account lock
    if (user.isLocked()) {
      const lockMinsRemaining = Math.ceil(
        (user.lockUntil - Date.now()) / 60000,
      );
      throw new ApiError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        `Account locked. Try again in ${lockMinsRemaining} minute(s).`,
      );
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment failed attempts
      const attempts = user.loginAttempts + 1;
      const updateData = { loginAttempts: attempts };

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        logger.warn('[AuthService] Account locked due to too many failed attempts:', {
          email,
          attempts,
        });
      }

      await User.updateOne({ _id: user._id }, updateData);
      throw new UnauthorizedError(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    // Check email verification
    if (!user.isEmailVerified) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        MESSAGES.AUTH.EMAIL_NOT_VERIFIED,
      );
    }

    // Check active status
    if (!user.isActive) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, MESSAGES.AUTH.ACCOUNT_INACTIVE);
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0 || user.lockUntil) {
      await User.updateOne(
        { _id: user._id },
        { loginAttempts: 0, lockUntil: null },
      );
    }

    // Issue tokens
    const { accessToken, refreshToken } = await this.issueTokenPair(user);

    logger.info('[AuthService] User logged in:', { userId: user._id });

    return { user, accessToken, refreshToken };
  }

  /**
   * Refresh the access token using a valid refresh token.
   * @param {string} rawRefreshToken
   * @returns {{ accessToken, refreshToken }}
   */
  async refreshTokens(rawRefreshToken) {
    const { userId } = verifyRefreshToken(rawRefreshToken);

    const user = await User.findById(userId).select('+refreshTokenHash');
    if (!user || !user.isActive) {
      throw new UnauthorizedError(MESSAGES.AUTH.UNAUTHORIZED);
    }

    // Verify stored hash matches incoming token
    const incomingHash = hashToken(rawRefreshToken);
    const isValid = timingSafeCompare(incomingHash, user.refreshTokenHash || '');

    if (!isValid) {
      // Possible refresh token reuse attack — revoke all sessions
      await User.updateOne({ _id: userId }, { refreshTokenHash: null });
      throw new UnauthorizedError('Refresh token reuse detected. Please log in again.');
    }

    const { accessToken, refreshToken } = await this.issueTokenPair(user);
    return { accessToken, refreshToken };
  }

  /**
   * Logout — revoke refresh token by clearing stored hash.
   * @param {string} userId
   */
  async logout(userId) {
    await User.updateOne({ _id: userId }, { refreshTokenHash: null });
    logger.info('[AuthService] User logged out:', { userId });
  }

  /**
   * Verify email using the raw token from the verification email link.
   * @param {string} rawToken
   */
  async verifyEmail(rawToken) {
    const hashedToken = hashToken(rawToken);

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        MESSAGES.AUTH.TOKEN_INVALID,
      );
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    logger.info('[AuthService] Email verified:', { userId: user._id });
  }

  /**
   * Initiate password reset — generate token, send email.
   * @param {string} email
   */
  async forgotPassword(email) {
    const user = await User.findOne({ email });

    // Security: always return same response whether user exists or not
    // (prevents email enumeration attacks)
    if (!user) return;

    const rawToken = generateSecureToken(32);
    const passwordResetToken = hashToken(rawToken);
    const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await User.updateOne(
      { _id: user._id },
      { passwordResetToken, passwordResetExpires },
    );

    this.sendPasswordResetEmail(user.email, user.firstName, rawToken).catch(
      (err) => logger.error('[AuthService] Failed to send password reset email:', { error: err.message }),
    );
  }

  /**
   * Reset password using valid reset token.
   * @param {string} rawToken
   * @param {string} newPassword
   */
  async resetPassword(rawToken, newPassword) {
    const hashedToken = hashToken(rawToken);

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, MESSAGES.AUTH.TOKEN_INVALID);
    }

    user.passwordHash = await User.hashPassword(newPassword);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.refreshTokenHash = null; // Invalidate all sessions on password change
    await user.save();

    logger.info('[AuthService] Password reset:', { userId: user._id });
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /**
   * Generate access + refresh token pair and persist refresh token hash.
   * @param {object} user - Mongoose User document
   * @returns {{ accessToken, refreshToken }}
   */
  async issueTokenPair(user) {
    const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });
    const refreshToken = signRefreshToken({ userId: user._id.toString() });

    // Store only the hash of the refresh token
    await User.updateOne(
      { _id: user._id },
      { refreshTokenHash: hashToken(refreshToken) },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Send email verification email.
   */
  async sendVerificationEmail(email, firstName, rawToken) {
    const verifyUrl = `${env.app.clientUrl}/verify-email?token=${rawToken}`;
    const transporter = createTransporter();

    await transporter.sendMail({
      from: env.email.from,
      to: email,
      subject: 'Verify your APIForge account',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to APIForge, ${firstName}!</h2>
          <p>Please verify your email address by clicking the button below.</p>
          <p>This link expires in ${env.email.verifyTokenExpiresHours} hours.</p>
          <a href="${verifyUrl}"
             style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;
                    border-radius:8px;text-decoration:none;font-weight:600;">
            Verify Email
          </a>
          <p style="color:#888;font-size:12px;margin-top:24px;">
            If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  }

  /**
   * Send password reset email.
   */
  async sendPasswordResetEmail(email, firstName, rawToken) {
    const resetUrl = `${env.app.clientUrl}/reset-password?token=${rawToken}`;
    const transporter = createTransporter();

    await transporter.sendMail({
      from: env.email.from,
      to: email,
      subject: 'Reset your APIForge password',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi ${firstName}, we received a request to reset your password.</p>
          <p>This link expires in 1 hour.</p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;
                    border-radius:8px;text-decoration:none;font-weight:600;">
            Reset Password
          </a>
          <p style="color:#888;font-size:12px;margin-top:24px;">
            If you didn't request a password reset, please ignore this email.
            Your account is safe.
          </p>
        </div>
      `,
    });
  }
}

export const authService = new AuthService();
