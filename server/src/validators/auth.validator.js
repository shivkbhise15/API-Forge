/**
 * @file auth.validator.js
 * @description express-validator rule chains for auth endpoints.
 *
 * Design:
 *   Validators are arrays of express-validator `check()` chains.
 *   They're attached to routes BEFORE the `validate` middleware runner.
 *   This keeps validation logic out of controllers and services.
 *
 * Rules:
 *   - Email is normalized (lowercased, trimmed) to prevent duplicates
 *   - Password rules enforce a reasonable security bar without being extreme
 *   - No validation logic — only input shape/type/format checking
 */

import { body, param } from 'express-validator';

export const authValidators = {
  /**
   * POST /auth/register
   */
  register: [
    body('firstName')
      .trim()
      .notEmpty().withMessage('First name is required')
      .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters'),

    body('lastName')
      .trim()
      .notEmpty().withMessage('Last name is required')
      .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters'),

    body('email')
      .trim()
      .normalizeEmail()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format'),

    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .isLength({ max: 128 }).withMessage('Password cannot exceed 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ],

  /**
   * POST /auth/login
   */
  login: [
    body('email')
      .trim()
      .normalizeEmail()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format'),

    body('password')
      .notEmpty().withMessage('Password is required'),
  ],

  /**
   * POST /auth/forgot-password
   */
  forgotPassword: [
    body('email')
      .trim()
      .normalizeEmail()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format'),
  ],

  /**
   * POST /auth/reset-password
   */
  resetPassword: [
    body('token')
      .notEmpty().withMessage('Reset token is required')
      .isLength({ min: 64, max: 64 }).withMessage('Invalid reset token format'),

    body('password')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .isLength({ max: 128 }).withMessage('Password cannot exceed 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ],

  /**
   * GET /auth/verify-email/:token
   */
  verifyEmail: [
    param('token')
      .notEmpty().withMessage('Verification token is required')
      .isLength({ min: 64, max: 64 }).withMessage('Invalid verification token format'),
  ],
};
