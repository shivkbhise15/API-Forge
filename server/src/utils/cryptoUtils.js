/**
 * @file cryptoUtils.js
 * @description Cryptographic utility functions.
 *
 * All crypto operations are centralized here to:
 *   1. Ensure consistent algorithm usage (SHA-256, crypto.randomBytes)
 *   2. Make security audits easy — one file to review
 *   3. Prevent accidental use of weak alternatives (Math.random, MD5)
 *
 * Security:
 *   - crypto.randomBytes: CSPRNG (Cryptographically Secure Pseudo-Random)
 *   - SHA-256: One-way, collision-resistant for token/key hashing
 *   - timingSafeEqual: Prevents timing attacks on token comparison
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically secure random hex string.
 * @param {number} byteLength - number of random bytes (hex string = 2x longer)
 * @returns {string} hex string
 */
export const generateSecureToken = (byteLength = 32) => {
  return crypto.randomBytes(byteLength).toString('hex');
};

/**
 * Generate a SHA-256 hash of a token/key.
 * Used for storing tokens and API keys without keeping the plaintext.
 * @param {string} token - plaintext value to hash
 * @returns {string} hex-encoded SHA-256 hash
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Timing-safe comparison of two strings.
 * Prevents timing attacks where an attacker infers correctness
 * by measuring how long a comparison takes.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export const timingSafeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  // Buffers must be same length for timingSafeEqual
  if (bufA.length !== bufB.length) {
    // Still do a comparison to prevent length-based timing leaks
    // (result will always be false but takes consistent time)
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Generate a secure API key with a prefix for fast DB lookup.
 *
 * Format: ak_{prefix8chars}_{random48chars}
 * Example: ak_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
 *
 * The prefix (first segment after ak_) is stored plaintext for indexed lookup.
 * The full key is hashed with SHA-256 for secure storage.
 *
 * @returns {{ fullKey: string, prefix: string, keyHash: string }}
 */
export const generateApiKey = () => {
  const randomBytes = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  const prefix = randomBytes.substring(0, 8);
  const suffix = randomBytes.substring(8);
  const fullKey = `ak_${prefix}_${suffix}`;
  const keyHash = hashToken(fullKey);

  return { fullKey, prefix, keyHash };
};

/**
 * Extract the prefix from a full API key string.
 * @param {string} apiKey - full API key (ak_{prefix}_{suffix})
 * @returns {string|null} prefix or null if format is invalid
 */
export const extractKeyPrefix = (apiKey) => {
  if (typeof apiKey !== 'string') return null;
  const parts = apiKey.split('_');
  if (parts.length < 3 || parts[0] !== 'ak') return null;
  return parts[1]; // the 8-char prefix segment
};
