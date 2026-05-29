/**
 * @file analytics.controller.js + analytics.routes.js
 */

import { analyticsService } from '../services/analytics.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export const analyticsController = {
  /**
   * GET /analytics/overview
   * Returns aggregate stats across ALL user's projects.
   */
  getOverview: async (req, res, next) => {
    try {
      const stats = await analyticsService.getOverviewStats(req.user.userId);

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.ANALYTICS.FETCHED, stats, null, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },

  /**
   * GET /analytics/dashboard?projectId=...&days=30
   * Full dashboard analytics for a project.
   */
  getDashboard: async (req, res, next) => {
    try {
      const { projectId, days } = req.query;
      if (!projectId) {
        return res.status(400).json({ success: false, message: 'projectId required.' });
      }

      const analytics = await analyticsService.getDashboardAnalytics(
        projectId, req.user.userId, { days: parseInt(days) || 30 },
      );

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.ANALYTICS.FETCHED, analytics, null, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },

  /**
   * GET /analytics/snapshots?projectId=...&days=30
   * Pre-aggregated daily snapshots (fast path for charts).
   */
  getSnapshots: async (req, res, next) => {
    try {
      const { projectId, days } = req.query;
      if (!projectId) {
        return res.status(400).json({ success: false, message: 'projectId required.' });
      }

      const { snapshots } = await analyticsService.getDailySnapshots(
        projectId, req.user.userId, parseInt(days) || 30,
      );

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.ANALYTICS.FETCHED, { snapshots }, null, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },
};
