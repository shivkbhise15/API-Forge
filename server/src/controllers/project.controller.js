/**
 * @file project.controller.js
 * @description Thin project route handlers.
 */

import { projectService } from '../services/project.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export const projectController = {
  /**
   * POST /api/v1/projects
   */
  create: async (req, res, next) => {
    try {
      const { name, description, environment, settings } = req.body;
      const { project } = await projectService.createProject(req.user.userId, {
        name, description, environment, settings,
      });

      return new ApiResponse(
        HTTP_STATUS.CREATED, MESSAGES.PROJECT.CREATED, { project }, null, req.requestId,
      ).send(res, HTTP_STATUS.CREATED);
    } catch (error) { next(error); }
  },

  /**
   * GET /api/v1/projects
   */
  list: async (req, res, next) => {
    try {
      const { projects, meta } = await projectService.listProjects(req.user.userId, req.query);

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.PROJECT.FETCHED, { projects }, meta, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },

  /**
   * GET /api/v1/projects/:id
   */
  getOne: async (req, res, next) => {
    try {
      const { project } = await projectService.getProject(req.params.id, req.user.userId);

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.PROJECT.FETCHED, { project }, null, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },

  /**
   * PUT /api/v1/projects/:id
   */
  update: async (req, res, next) => {
    try {
      const { project } = await projectService.updateProject(
        req.params.id, req.user.userId, req.body,
      );

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.PROJECT.UPDATED, { project }, null, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },

  /**
   * DELETE /api/v1/projects/:id
   */
  delete: async (req, res, next) => {
    try {
      await projectService.deleteProject(req.params.id, req.user.userId);

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.PROJECT.DELETED, null, null, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },
};
