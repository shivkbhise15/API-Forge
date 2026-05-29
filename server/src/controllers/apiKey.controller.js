/**
 * @file apiKey.controller.js
 * @description API Key route handlers — thin controllers.
 *
 * Security note on key creation response:
 *   The `fullKey` field is ONLY present in the CREATE response.
 *   This is explicitly documented in the response message.
 *   All other endpoints return the key document WITHOUT the actual key value.
 */

import { apiKeyService } from '../services/apiKey.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export const apiKeyController = {
  /**
   * POST /api/v1/keys
   * Creates a new API key. Returns fullKey ONCE — warn user to save it.
   */
  create: async (req, res, next) => {
    try {
      const { projectId, name, description, scopes, expiresAt, rateLimit } = req.body;
      const { apiKey, fullKey } = await apiKeyService.createKey(
        req.user.userId, projectId, { name, description, scopes, expiresAt, rateLimit },
      );

      return new ApiResponse(
        HTTP_STATUS.CREATED,
        `${MESSAGES.API_KEY.CREATED} Save your key now — it will not be shown again.`,
        { apiKey, fullKey },   // ← fullKey shown ONCE
        null,
        req.requestId,
      ).send(res, HTTP_STATUS.CREATED);
    } catch (error) { next(error); }
  },

  /**
   * GET /api/v1/keys?projectId=...
   * Lists all keys for a project (no fullKey returned).
   */
  list: async (req, res, next) => {
    try {
      const { keys, meta } = await apiKeyService.listKeys(
        req.query.projectId, req.user.userId, req.query,
      );

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.API_KEY.FETCHED, { keys }, meta, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },

  /**
   * GET /api/v1/keys/:id
   */
  getOne: async (req, res, next) => {
    try {
      const { apiKey } = await apiKeyService.getKey(req.params.id, req.user.userId);

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.API_KEY.FETCHED, { apiKey }, null, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },

  /**
   * PATCH /api/v1/keys/:id — update name/description/rateLimit
   */
  update: async (req, res, next) => {
    try {
      const { apiKey } = await apiKeyService.updateKey(
        req.params.id, req.user.userId, req.body,
      );

      return new ApiResponse(
        HTTP_STATUS.OK, 'API key updated successfully.', { apiKey }, null, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },

  /**
   * PATCH /api/v1/keys/:id/revoke
   */
  revoke: async (req, res, next) => {
    try {
      await apiKeyService.revokeKey(req.params.id, req.user.userId);

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.API_KEY.REVOKED, null, null, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },

  /**
   * DELETE /api/v1/keys/:id
   * Hard delete — only allowed after revocation.
   */
  delete: async (req, res, next) => {
    try {
      await apiKeyService.deleteKey(req.params.id, req.user.userId);

      return new ApiResponse(
        HTTP_STATUS.OK, MESSAGES.API_KEY.DELETED, null, null, req.requestId,
      ).send(res, HTTP_STATUS.OK);
    } catch (error) { next(error); }
  },
};
