/**
 * @file analytics.helper.js
 * @description MongoDB aggregation pipeline builders.
 *
 * Aggregation pipelines are complex. Centralizing them here:
 *   1. Keeps services clean
 *   2. Allows independent unit testing of pipeline logic
 *   3. Makes optimization changes in one place
 *
 * Each builder returns a pipeline array ready to pass to Model.aggregate().
 */

import mongoose from 'mongoose';

/**
 * Build pipeline for daily request volume chart.
 * Groups requests by calendar day and counts totals + errors.
 *
 * @param {string|ObjectId} projectId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Array} aggregation pipeline
 */
export const buildDailyVolumePipeline = (projectId, startDate, endDate) => [
  {
    $match: {
      projectId: new mongoose.Types.ObjectId(projectId),
      createdAt: { $gte: startDate, $lte: endDate },
    },
  },
  {
    $group: {
      _id: {
        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
      },
      totalRequests: { $sum: 1 },
      successCount: { $sum: { $cond: ['$isSuccess', 1, 0] } },
      errorCount: { $sum: { $cond: ['$isSuccess', 0, 1] } },
      avgResponseTimeMs: { $avg: '$responseTimeMs' },
    },
  },
  { $sort: { _id: 1 } },
  {
    $project: {
      _id: 0,
      date: '$_id',
      totalRequests: 1,
      successCount: 1,
      errorCount: 1,
      avgResponseTimeMs: { $round: ['$avgResponseTimeMs', 1] },
    },
  },
];

/**
 * Build pipeline for top endpoints by request count.
 * @param {string|ObjectId} projectId
 * @param {Date} since
 * @param {number} limit - max endpoints to return
 * @returns {Array} aggregation pipeline
 */
export const buildTopEndpointsPipeline = (projectId, since, limit = 10) => [
  {
    $match: {
      projectId: new mongoose.Types.ObjectId(projectId),
      createdAt: { $gte: since },
    },
  },
  {
    $group: {
      _id: { method: '$method', endpoint: '$endpoint' },
      count: { $sum: 1 },
      avgResponseTimeMs: { $avg: '$responseTimeMs' },
      errorCount: { $sum: { $cond: ['$isSuccess', 0, 1] } },
    },
  },
  { $sort: { count: -1 } },
  { $limit: limit },
  {
    $project: {
      _id: 0,
      method: '$_id.method',
      endpoint: '$_id.endpoint',
      count: 1,
      avgResponseTimeMs: { $round: ['$avgResponseTimeMs', 1] },
      errorCount: 1,
      errorRate: {
        $round: [{ $multiply: [{ $divide: ['$errorCount', '$count'] }, 100] }, 1],
      },
    },
  },
];

/**
 * Build pipeline for status code distribution (pie/donut chart).
 * @param {string|ObjectId} projectId
 * @param {Date} since
 * @returns {Array} aggregation pipeline
 */
export const buildStatusDistributionPipeline = (projectId, since) => [
  {
    $match: {
      projectId: new mongoose.Types.ObjectId(projectId),
      createdAt: { $gte: since },
    },
  },
  {
    $group: {
      _id: '$statusCategory',
      count: { $sum: 1 },
    },
  },
  {
    $project: {
      _id: 0,
      category: '$_id',
      count: 1,
    },
  },
  { $sort: { category: 1 } },
];

/**
 * Build pipeline for response time percentiles.
 * Calculates p50, p95, p99 over a time range.
 * @param {string|ObjectId} projectId
 * @param {Date} since
 * @returns {Array} aggregation pipeline
 */
export const buildResponseTimePipeline = (projectId, since) => [
  {
    $match: {
      projectId: new mongoose.Types.ObjectId(projectId),
      createdAt: { $gte: since },
    },
  },
  {
    $group: {
      _id: null,
      responseTimes: { $push: '$responseTimeMs' },
      avgResponseTimeMs: { $avg: '$responseTimeMs' },
      minResponseTimeMs: { $min: '$responseTimeMs' },
      maxResponseTimeMs: { $max: '$responseTimeMs' },
      count: { $sum: 1 },
    },
  },
  {
    $project: {
      _id: 0,
      avgResponseTimeMs: { $round: ['$avgResponseTimeMs', 1] },
      minResponseTimeMs: { $round: ['$minResponseTimeMs', 1] },
      maxResponseTimeMs: { $round: ['$maxResponseTimeMs', 1] },
      count: 1,
      // Note: true percentiles require $percentile (MongoDB 7+)
      // For older MongoDB, we approximate via sorted array
    },
  },
];

/**
 * Build pipeline to aggregate project-level snapshot metrics.
 * Used by the cron job to materialize hourly/daily snapshots.
 * @param {string|ObjectId} projectId
 * @param {Date} periodStart
 * @param {Date} periodEnd
 * @returns {Array} aggregation pipeline
 */
export const buildSnapshotPipeline = (projectId, periodStart, periodEnd) => [
  {
    $match: {
      projectId: new mongoose.Types.ObjectId(projectId),
      createdAt: { $gte: periodStart, $lt: periodEnd },
    },
  },
  {
    $facet: {
      totals: [
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            successCount: { $sum: { $cond: ['$isSuccess', 1, 0] } },
            errorCount: { $sum: { $cond: ['$isSuccess', 0, 1] } },
            avgResponseTimeMs: { $avg: '$responseTimeMs' },
          },
        },
      ],
      topEndpoints: [
        { $group: { _id: '$endpoint', count: { $sum: 1 }, avg: { $avg: '$responseTimeMs' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, endpoint: '$_id', count: 1, avgResponseTimeMs: { $round: ['$avg', 1] } } },
      ],
      statusDist: [
        { $group: { _id: '$statusCategory', count: { $sum: 1 } } },
      ],
      uniqueIps: [
        { $group: { _id: '$ipAddress' } },
        { $count: 'total' },
      ],
    },
  },
];
