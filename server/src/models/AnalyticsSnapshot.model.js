/**
 * @file AnalyticsSnapshot.model.js
 * @description Pre-aggregated analytics snapshot schema.
 *
 * Why pre-aggregate?
 *   Running MongoDB aggregation pipelines over millions of request logs
 *   in real-time for dashboard queries would be extremely slow.
 *
 *   Instead, a cron job runs periodically and materializes the results
 *   into this collection. Dashboard queries hit this tiny collection
 *   instead of the massive request_logs collection.
 *
 *   Pattern: CQRS (Command Query Responsibility Segregation) lite.
 *   Writes go to RequestLog. Reads come from AnalyticsSnapshot.
 *
 * Update Strategy:
 *   Hourly cron: aggregate the last hour → upsert into snapshots (hourly period)
 *   Daily cron:  aggregate the last day  → upsert into snapshots (daily period)
 *   Monthly job: aggregate the last month → upsert (monthly period)
 *
 *   Upsert prevents duplicate snapshots if the cron runs twice.
 *
 * Indexing:
 *   - (projectId, period, date): primary read query
 *   - (apiKeyId, period, date): per-key analytics
 */

import mongoose from 'mongoose';

const endpointStatSchema = new mongoose.Schema({
  endpoint: String,
  count: Number,
  avgResponseTimeMs: Number,
}, { _id: false });

const analyticsSnapshotSchema = new mongoose.Schema(
  {
    // ── Scope ────────────────────────────────────────────────────────────
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    apiKeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApiKey',
      default: null, // null = aggregate across ALL keys in project
    },

    // ── Time Period ───────────────────────────────────────────────────────
    period: {
      type: String,
      enum: ['hourly', 'daily', 'monthly'],
      required: true,
    },
    date: {
      type: Date,
      required: true, // Truncated to period start: hour/day/month boundary
    },

    // ── Metrics ───────────────────────────────────────────────────────────
    metrics: {
      totalRequests: { type: Number, default: 0 },
      successCount: { type: Number, default: 0 },
      errorCount: { type: Number, default: 0 },
      avgResponseTimeMs: { type: Number, default: 0 },
      p95ResponseTimeMs: { type: Number, default: 0 },
      uniqueIps: { type: Number, default: 0 },
      topEndpoints: { type: [endpointStatSchema], default: [] },
      statusCodeDistribution: {
        '2xx': { type: Number, default: 0 },
        '3xx': { type: Number, default: 0 },
        '4xx': { type: Number, default: 0 },
        '5xx': { type: Number, default: 0 },
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ── Compound unique index: one snapshot per (project, key, period, date) ──
analyticsSnapshotSchema.index(
  { projectId: 1, apiKeyId: 1, period: 1, date: 1 },
  { unique: true },
);
analyticsSnapshotSchema.index({ projectId: 1, period: 1, date: -1 }); // dashboard range query
analyticsSnapshotSchema.index({ apiKeyId: 1, period: 1, date: -1 });  // per-key analytics

export const AnalyticsSnapshot = mongoose.model('AnalyticsSnapshot', analyticsSnapshotSchema);
