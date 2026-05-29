/**
 * @file log.controller.js + log.routes.js (combined for brevity)
 * @description Log query handlers.
 */

import { logService } from '../services/log.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export const logController = {
  /**
   * GET /api/v1/logs?projectId=...&page=1&limit=20
   */
  getProjectLogs: async (req, res, next) => {
    try {
      const { projectId } = req.query;
      if (!projectId) {
        return res.status(400).json({ success: false, message: 'projectId query param required.' });
      }

      const { logs, meta } = await logService.getLogs(projectId, req.user.userId, req.query);

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.LOG.FETCHED, { logs }, meta, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },

  /**
   * GET /api/v1/logs/:id
   */
  getOne: async (req, res, next) => {
    try {
      const { log } = await logService.getLog(req.params.id, req.user.userId);

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.LOG.FETCHED, { log }, null, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },

  /**
   * GET /api/v1/logs/summary?projectId=...
   */
  getProjectSummary: async (req, res, next) => {
    try {
      const { projectId } = req.query;
      if (!projectId) {
        return res.status(400).json({ success: false, message: 'projectId required.' });
      }

      const summary = await logService.getProjectSummary(projectId, req.user.userId);

      return new ApiResponse(
        HTTP_STATUS.OK, 'Summary retrieved.', summary, null, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },
};
