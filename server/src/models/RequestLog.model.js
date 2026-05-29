/**
 * @file RequestLog.model.js
 * @description Request log schema — the highest-volume collection in APIForge.
 *
 * Volume Considerations:
 *   A busy API with 1000 req/s generates 86.4M logs/day.
 *   Design decisions to handle this:
 *
 *   1. TTL Index: logs auto-expire after 90 days. The database self-manages
 *      size without requiring a separate cleanup job.
 *
 *   2. Compound Indexes: every query pattern has a matching compound index.
 *      No collection scans allowed at scale.
 *
 *   3. Sparse metadata: headers/body are NOT stored by default.
 *      Only structured fields are indexed. Raw data is opt-in.
 *
 *   4. No references populated on read: all foreign key values are stored
 *      as raw strings too (userId, projectId) to avoid $lookup on hot queries.
 *
 * Scaling Path:
 *   - MongoDB Time Series collection (replace this schema at scale)
 *   - ClickHouse for analytical queries (OLAP vs OLTP separation)
 *   - Write to a queue (Bull/RabbitMQ) → batch insert to reduce write pressure
 *
 * Indexing Strategy:
 *   - (apiKeyId + createdAt): per-key log timeline (most common query)
 *   - (projectId + createdAt): per-project analytics
 *   - (userId + createdAt): admin user activity
 *   - (statusCode + createdAt): error rate queries
 *   - TTL on createdAt: auto-purge after 90 days
 */

import mongoose from 'mongoose';

const requestLogSchema = new mongoose.Schema(
  {
    // ── Request Context ───────────────────────────────────────────────────
    apiKeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApiKey',
      required: true,
    },
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

    // ── Request Details ───────────────────────────────────────────────────
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
      maxlength: 2048, // URL length limit
    },
    statusCode: {
      type: Number,
      required: true,
      min: 100,
      max: 599,
    },
    responseTimeMs: {
      type: Number,
      required: true,
      min: 0,
    },

    // ── Request/Response Size ─────────────────────────────────────────────
    requestSizeBytes: {
      type: Number,
      default: 0,
    },
    responseSizeBytes: {
      type: Number,
      default: 0,
    },

    // ── Client Info ───────────────────────────────────────────────────────
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      maxlength: 512,
      default: null,
    },

    // ── Error Info ────────────────────────────────────────────────────────
    errorMessage: {
      type: String,
      default: null,
    },

    // ── Derived Fields (computed at write time for fast aggregation) ───────
    isSuccess: {
      type: Boolean,
      required: true, // true if statusCode < 400
    },
    statusCategory: {
      type: String,
      enum: ['2xx', '3xx', '4xx', '5xx'],
      required: true,
    },
  },
  {
    timestamps: true, // createdAt used for TTL
    // Disable Mongoose versionKey — not needed for high-volume append-only collection
    versionKey: false,
  },
);

// ── TTL Index — auto-purge logs older than 90 days ────────────────────────
requestLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

// ── Query-pattern indexes ─────────────────────────────────────────────────
requestLogSchema.index({ apiKeyId: 1, createdAt: -1 });    // per-key timeline
requestLogSchema.index({ projectId: 1, createdAt: -1 });   // per-project analytics
requestLogSchema.index({ userId: 1, createdAt: -1 });      // per-user activity
requestLogSchema.index({ statusCode: 1, createdAt: -1 });  // error rate queries
requestLogSchema.index({ projectId: 1, isSuccess: 1, createdAt: -1 }); // success/fail ratio

export const RequestLog = mongoose.model('RequestLog', requestLogSchema);
