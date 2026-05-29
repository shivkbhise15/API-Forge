/**
 * @file User.model.js
 * @description Mongoose User schema.
 *
 * Design Decisions:
 *   - passwordHash: bcrypt hash is stored, never plaintext
 *   - refreshTokenHash: SHA-256 hash of the refresh token (not the token itself)
 *     Storing the hash means even if DB is breached, tokens can't be replayed
 *   - emailVerificationToken: hashed token for verification emails
 *   - passwordResetToken: hashed token with TTL for password reset flow
 *   - loginAttempts + lockUntil: brute-force protection (max 5 attempts → 1h lock)
 *
 * Indexing:
 *   - email: unique index (used for login lookup)
 *   - role: for admin queries
 *   - createdAt: for admin user listing with date range filters
 *
 * Scalability:
 *   At millions of users, add sharding on _id (default).
 *   Email lookups stay O(log n) via index.
 *
 * Future:
 *   - Add OAuth provider fields (googleId, githubId)
 *   - Add MFA fields (totpSecret, mfaEnabled)
 *   - Add lastPasswordChangedAt for security policies
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../constants/roles.js';

const SALT_ROUNDS = 12; // bcrypt cost factor: 12 is ~300ms — good balance for auth endpoints

const userSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },

    // ── Security ──────────────────────────────────────────────────────────
    passwordHash: {
      type: String,
      required: true,
      select: false, // NEVER returned in queries unless explicitly requested
    },
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },

    // ── Email Verification ────────────────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
      default: null,
    },

    // ── Password Reset ────────────────────────────────────────────────────
    passwordResetToken: {
      type: String,
      select: false,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
      default: null,
    },

    // ── Brute Force Protection ────────────────────────────────────────────
    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      default: null,
      select: false,
    },

    // ── Account Status ────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },

    // ── Profile ───────────────────────────────────────────────────────────
    avatarUrl: {
      type: String,
      default: null,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
  },
  {
    timestamps: true, // auto-adds createdAt, updatedAt
    toJSON: {
      // Strip sensitive fields when converting to JSON
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.refreshTokenHash;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.loginAttempts;
        delete ret.lockUntil;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ── Indexes ──────────────────────────clear─────────────────────────────────────
// unique — declared in schema field
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1, role: 1 }); // admin dashboard queries

// ── Instance Methods ──────────────────────────────────────────────────────

/**
 * Compare a plaintext password against the stored hash.
 * Uses bcrypt.compare (timing-safe).
 */
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

/**
 * Check if the account is currently locked (too many failed logins).
 */
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > new Date();
};

/**
 * Returns the user's full name.
 */
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ── Static Methods ────────────────────────────────────────────────────────

/**
 * Hash a plaintext password.
 * @param {string} password
 * @returns {Promise<string>}
 */
userSchema.statics.hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const User = mongoose.model('User', userSchema);
