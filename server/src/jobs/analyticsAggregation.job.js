/**
 * @file analyticsAggregation.job.js
 * @description Cron jobs for materializing analytics snapshots.
 *
 * Architecture — Materialized Views Pattern:
 *   These cron jobs read from RequestLog (high-volume, write-optimized)
 *   and write to AnalyticsSnapshot (small, read-optimized).
 *   This is the Node.js equivalent of a materialized view in SQL.
 *
 * Schedule:
 *   - Hourly job: runs at :05 past every hour (avoids :00 thundering herd)
 *   - Daily job: runs at 00:10 UTC
 *   - Both use upsert so re-runs are idempotent (safe to run multiple times)
 *
 * Production Consideration:
 *   In a multi-instance deployment, multiple servers would run the same cron.
 *   Use a Redis lock (or MongoDB findAndModify) to ensure only one instance
 *   processes each job. For now, upsert makes double-runs harmless (just redundant).
 *
 * Future:
 *   Replace cron with a queue consumer (Bull) triggered by request thresholds.
 *   E.g., "after every 1000 requests to a project, refresh its snapshot."
 */

import cron from 'node-cron';
import mongoose from 'mongoose';
import { RequestLog } from '../models/RequestLog.model.js';
import { AnalyticsSnapshot } from '../models/AnalyticsSnapshot.model.js';
import { Project } from '../models/Project.model.js';
import { buildSnapshotPipeline } from '../helpers/analytics.helper.js';
import { logger } from '../config/logger.js';

/**
 * Get the start of the current hour (UTC).
 * e.g., 14:37 → 14:00:00.000
 */
const startOfHour = (date = new Date()) => {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d;
};

/**
 * Get the start of the current day (UTC).
 */
const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Aggregate and upsert a snapshot for a given project and time period.
 * @param {string} projectId
 * @param {Date} periodStart
 * @param {Date} periodEnd
 * @param {'hourly'|'daily'} period
 */
const aggregateAndSave = async (projectId, periodStart, periodEnd, period) => {
  try {
    const [result] = await RequestLog.aggregate(
      buildSnapshotPipeline(projectId, periodStart, periodEnd),
    );

    if (!result) return;

    const { totals, topEndpoints, statusDist, uniqueIps } = result;
    const t = totals[0] || {};

    // Build status distribution object
    const statusCodeDistribution = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    statusDist.forEach(({ _id, count }) => {
      if (statusCodeDistribution.hasOwnProperty(_id)) {
        statusCodeDistribution[_id] = count;
      }
    });

    // Upsert: create or replace snapshot for this (project, period, date) combo
    await AnalyticsSnapshot.findOneAndUpdate(
      { projectId, apiKeyId: null, period, date: periodStart },
      {
        $set: {
          metrics: {
            totalRequests: t.totalRequests || 0,
            successCount: t.successCount || 0,
            errorCount: t.errorCount || 0,
            avgResponseTimeMs: Math.round(t.avgResponseTimeMs || 0),
            p95ResponseTimeMs: 0, // Would need $percentile (MongoDB 7+)
            uniqueIps: uniqueIps[0]?.total || 0,
            topEndpoints,
            statusCodeDistribution,
          },
        },
      },
      { upsert: true, new: true },
    );
  } catch (error) {
    logger.error('[AnalyticsJob] Failed to aggregate project:', {
      projectId,
      period,
      error: error.message,
    });
  }
};

/**
 * Run snapshot aggregation for ALL active projects.
 * @param {'hourly'|'daily'} period
 * @param {Date} periodStart
 * @param {Date} periodEnd
 */
const runAggregationJob = async (period, periodStart, periodEnd) => {
  const jobStart = Date.now();
  logger.info(`[AnalyticsJob] Starting ${period} aggregation...`, { periodStart, periodEnd });

  try {
    // Get all active projects with requests in this period
    const activeProjectIds = await RequestLog.distinct('projectId', {
      createdAt: { $gte: periodStart, $lt: periodEnd },
    });

    if (!activeProjectIds.length) {
      logger.info(`[AnalyticsJob] No activity found for ${period} period.`);
      return;
    }

    // Process in parallel with concurrency limit
    const BATCH_SIZE = 10;
    for (let i = 0; i < activeProjectIds.length; i += BATCH_SIZE) {
      const batch = activeProjectIds.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((projectId) =>
          aggregateAndSave(projectId, periodStart, periodEnd, period),
        ),
      );
    }

    const duration = Date.now() - jobStart;
    logger.info(`[AnalyticsJob] ${period} aggregation complete.`, {
      projectsProcessed: activeProjectIds.length,
      durationMs: duration,
    });
  } catch (error) {
    logger.error(`[AnalyticsJob] ${period} job failed:`, { error: error.message });
  }
};

/**
 * Register and start all analytics cron jobs.
 * Call this from server.js after DB connection is established.
 */
export const startAnalyticsJobs = () => {
  // ── Hourly: aggregate the previous hour at :05 past every hour ──────────
  cron.schedule('5 * * * *', async () => {
    const periodEnd = startOfHour();                       // current hour start
    const periodStart = new Date(periodEnd - 60 * 60 * 1000); // one hour before
    await runAggregationJob('hourly', periodStart, periodEnd);
  });

  // ── Daily: aggregate the previous day at 00:10 UTC ──────────────────────
  cron.schedule('10 0 * * *', async () => {
    const periodEnd = startOfDay();                          // today midnight UTC
    const periodStart = new Date(periodEnd - 24 * 60 * 60 * 1000); // yesterday
    await runAggregationJob('daily', periodStart, periodEnd);
  });

  logger.info('[AnalyticsJob] Cron jobs registered: hourly (5m past), daily (00:10 UTC).');
};
