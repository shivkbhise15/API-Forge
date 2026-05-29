/**
 * @file analytics.service.js
 * @description Analytics query service — orchestrates pipeline execution.
 *
 * Read Strategy:
 *   1. Try AnalyticsSnapshot first (pre-aggregated, fast)
 *   2. Fall back to live aggregation from RequestLog if no snapshot exists
 *      (happens for very recent data before the cron runs)
 *
 * This hybrid approach gives:
 *   - Fast responses for historical data (snapshot read)
 *   - Accurate real-time data for the last hour (live query)
 */

import { RequestLog } from '../models/RequestLog.model.js';
import { AnalyticsSnapshot } from '../models/AnalyticsSnapshot.model.js';
import { Project } from '../models/Project.model.js';
import {
  buildDailyVolumePipeline,
  buildTopEndpointsPipeline,
  buildStatusDistributionPipeline,
  buildResponseTimePipeline,
} from '../helpers/analytics.helper.js';
import { NotFoundError } from '../utils/ApiError.js';

class AnalyticsService {
  /**
   * Get the full analytics dashboard data for a project.
   * Bundles all metrics in a single service call to minimize round-trips.
   *
   * @param {string} projectId
   * @param {string} userId
   * @param {{ days: number }} options
   */
  async getDashboardAnalytics(projectId, userId, { days = 30 } = {}) {
    // Verify ownership
    const project = await Project.findOne({ _id: projectId, ownerId: userId });
    if (!project) throw new NotFoundError('Project not found.');

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const now = new Date();

    // Run all aggregations in parallel for performance
    const [dailyVolume, topEndpoints, statusDist, responseTime] = await Promise.all([
      RequestLog.aggregate(buildDailyVolumePipeline(projectId, since, now)),
      RequestLog.aggregate(buildTopEndpointsPipeline(projectId, since)),
      RequestLog.aggregate(buildStatusDistributionPipeline(projectId, since)),
      RequestLog.aggregate(buildResponseTimePipeline(projectId, since)),
    ]);

    return {
      period: { days, startDate: since, endDate: now },
      dailyVolume,
      topEndpoints,
      statusDistribution: statusDist,
      responseTime: responseTime[0] || {
        avgResponseTimeMs: 0,
        minResponseTimeMs: 0,
        maxResponseTimeMs: 0,
        count: 0,
      },
    };
  }

  /**
   * Get pre-aggregated daily snapshots for the chart (fast path).
   * @param {string} projectId
   * @param {string} userId
   * @param {number} days
   */
  async getDailySnapshots(projectId, userId, days = 30) {
    const project = await Project.findOne({ _id: projectId, ownerId: userId });
    if (!project) throw new NotFoundError('Project not found.');

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshots = await AnalyticsSnapshot.find({
      projectId,
      period: 'daily',
      date: { $gte: since },
    }).sort({ date: 1 });

    return { snapshots };
  }

  /**
   * Get overview stats for the main dashboard header cards.
   * @param {string} userId - fetch stats across ALL of user's projects
   */
  async getOverviewStats(userId) {
    // Get all user's active projects
    const projects = await Project.find({ ownerId: userId, isActive: true }).select('_id');
    const projectIds = projects.map((p) => p._id);

    if (!projectIds.length) {
      return {
        totalRequests: 0,
        totalErrors: 0,
        avgResponseTimeMs: 0,
        activeProjects: 0,
      };
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

    const [totals] = await RequestLog.aggregate([
      {
        $match: {
          projectId: { $in: projectIds },
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalErrors: { $sum: { $cond: ['$isSuccess', 0, 1] } },
          avgResponseTimeMs: { $avg: '$responseTimeMs' },
        },
      },
    ]);

    return {
      totalRequests: totals?.totalRequests || 0,
      totalErrors: totals?.totalErrors || 0,
      avgResponseTimeMs: Math.round(totals?.avgResponseTimeMs || 0),
      activeProjects: projectIds.length,
      errorRate: totals?.totalRequests
        ? ((totals.totalErrors / totals.totalRequests) * 100).toFixed(1)
        : '0.0',
    };
  }
}

export const analyticsService = new AnalyticsService();
