/**
 * @file ApiKey.model.js
 * @description API Key schema — the security-critical core of APIForge.
 *
 * Security Design (read this carefully):
 *   The full API key is NEVER stored in the database.
 *   Storage pattern:
 *     - `keyPrefix`: first 8 chars of the key body (after "ak_"), stored plaintext.
 *       Used for fast indexed lookup without scanning all keys.
 *     - `keyHash`: SHA-256 of the FULL key string. Used for validation.
 *
 *   Validation flow on incoming request:
 *     1. Extract prefix from incoming key  O(1) — string operation
 *     2. Query DB by prefix               O(log n) — indexed
 *     3. SHA-256 hash incoming key         O(1) — ~microseconds
 *     4. timingSafeEqual compare           O(1) — timing-attack proof
 *
 *   Why prefix + hash instead of just hash?
 *     Hashing alone requires scanning the full keys collection (no index on hash).
 *     The prefix narrows the search to a tiny subset before hash comparison.
 *     This scales to millions of keys without full table scans.
 *
 * Scopes:
 *   Fine-grained permission model — API keys can be restricted to specific
 *   operations. Future: enforce scopes in middleware per endpoint.
 *
 * Expiration:
 *   `expiresAt: null` = never expires. The middleware checks this field.
 *
 * Indexing:
 *   - `keyPrefix` (primary lookup index)
 *   - `projectId + isActive` (list keys for a project)
 *   - `userId + isActive`
 *   - `expiresAt` (TTL-adjacent: find expired keys for cleanup job)
 */

import mongoose from 'mongoose';

const API_KEY_SCOPES = ['read', 'write', 'admin', 'analytics'];

const apiKeySchema = new mongoose.Schema(
  {
    // ── Identification ────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'API key name is required'],
      trim: true,
      maxlength: [100, 'Key name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: '',
    },

    // ── Ownership ─────────────────────────────────────────────────────────
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Security (THE CRITICAL FIELDS) ────────────────────────────────────
    keyPrefix: {
      type: String,
      required: true,
      // NOT unique globally — multiple keys can share a prefix (extremely rare but possible)
      // The combination keyPrefix + keyHash uniquely identifies a key
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,     // SHA-256 hash collision probability: effectively zero
      select: false,    // Never returned in API responses
    },

    // ── Permissions ───────────────────────────────────────────────────────
    scopes: {
      type: [String],
      enum: API_KEY_SCOPES,
      default: ['read'],
    },

    // ── Lifecycle ─────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: null,    // null = never expires
    },

    // ── Usage Tracking (denormalized for fast reads) ───────────────────────
    lastUsedAt: {
      type: Date,
      default: null,
    },
    totalRequests: {
      type: Number,
      default: 0,
    },

    // ── Per-Key Rate Limiting ─────────────────────────────────────────────
    rateLimit: {
      requestsPerMin: {
        type: Number,
        default: 60,
        min: 1,
        max: 10000,
      },
      requestsPerDay: {
        type: Number,
        default: 10000,
        min: 1,
        max: 1000000,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.keyHash; // extra safety — already select: false
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ── Indexes ───────────────────────────────────────────────────────────────
apiKeySchema.index({ keyPrefix: 1 });                    // PRIMARY: fast lookup on incoming request
apiKeySchema.index({ projectId: 1, isActive: 1 });       // list keys for project
apiKeySchema.index({ userId: 1, isActive: 1 });          // list keys for user
apiKeySchema.index({ expiresAt: 1 }, { sparse: true });  // find expiring keys
apiKeySchema.index({ createdAt: -1 });

// ── Virtual: check if key is expired ─────────────────────────────────────
apiKeySchema.virtual('isExpired').get(function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

export const ApiKey = mongoose.model('ApiKey', apiKeySchema);
export { API_KEY_SCOPES };
