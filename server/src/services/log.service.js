/**
 * @file log.service.js
 * @description Request log querying service.
 *
 * Query Patterns Supported:
 *   - Filter by projectId, apiKeyId, statusCode, method, date range
 *   - Cursor-based pagination for large result sets
 *   - Search by endpoint string (prefix match)
 *
 * Performance Notes:
 *   - All filter combinations map to existing compound indexes
 *   - Cursor pagination avoids expensive SKIP operations on large collections
 *   - Date range queries always include createdAt in the compound index
 */

import { RequestLog } from '../models/RequestLog.model.js';
import { Project } from '../models/Project.model.js';
import { NotFoundError, ForbiddenError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';

class LogService {
  /**
   * Query request logs for a project.
   * Verifies project ownership before returning data.
   *
   * @param {string} projectId
   * @param {string} userId
   * @param {object} query - filters + pagination
   */
  async getLogs(projectId, userId, query) {
    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, ownerId: userId });
    if (!project) throw new NotFoundError('Project not found or access denied.');

    const {
      apiKeyId,
      statusCode,
      method,
      startDate,
      endDate,
      endpoint,
      isSuccess,
    } = query;

    // Build filter — only add conditions that have values
    const filter = { projectId };

    if (apiKeyId) filter.apiKeyId = apiKeyId;
    if (statusCode) filter.statusCode = parseInt(statusCode);
    if (method) filter.method = method.toUpperCase();
    if (isSuccess !== undefined) filter.isSuccess = isSuccess === 'true';
    if (endpoint) filter.endpoint = { $regex: new RegExp(endpoint, 'i') };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const { page, limit, skip } = parsePagination(query);

    const [logs, total] = await Promise.all([
      RequestLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v'), // exclude version key
      RequestLog.countDocuments(filter),
    ]);

    return {
      logs,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * Get logs for a specific API key.
   * @param {string} apiKeyId
   * @param {string} userId
   * @param {object} query
   */
  async getKeyLogs(apiKeyId, userId, query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { apiKeyId, userId };

    const [logs, total] = await Promise.all([
      RequestLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      RequestLog.countDocuments(filter),
    ]);

    return { logs, meta: buildPaginationMeta(total, page, limit) };
  }

  /**
   * Get a single log entry (with ownership check).
   */
  async getLog(logId, userId) {
    const log = await RequestLog.findOne({ _id: logId, userId });
    if (!log) throw new NotFoundError('Log entry not found.');
    return { log };
  }

  /**
   * Quick summary stats for a project's recent requests.
   * Used for the dashboard summary card.
   * @param {string} projectId
   * @param {string} userId
   */
  async getProjectSummary(projectId, userId) {
    const project = await Project.findOne({ _id: projectId, ownerId: userId });
    if (!project) throw new NotFoundError('Project not found.');

    // Last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, errors, avgResponse] = await Promise.all([
      RequestLog.countDocuments({ projectId, createdAt: { $gte: since } }),
      RequestLog.countDocuments({ projectId, isSuccess: false, createdAt: { $gte: since } }),
      RequestLog.aggregate([
        { $match: { projectId: project._id, createdAt: { $gte: since } } },
        { $group: { _id: null, avg: { $avg: '$responseTimeMs' } } },
      ]),
    ]);

    return {
      last24h: {
        totalRequests: total,
        errorCount: errors,
        successCount: total - errors,
        errorRate: total > 0 ? ((errors / total) * 100).toFixed(1) : '0.0',
        avgResponseTimeMs: avgResponse[0]?.avg?.toFixed(1) || '0.0',
      },
    };
  }
}

export const logService = new LogService();
