/**
 * @file apiKey.validator.js
 * @description Validation chains for API key management endpoints.
 */

import { body, param, query } from 'express-validator';
import { API_KEY_SCOPES } from '../models/ApiKey.model.js';

export const apiKeyValidators = {
  /**
   * POST /keys — create a new API key
   */
  create: [
    body('projectId')
      .notEmpty().withMessage('Project ID is required')
      .isMongoId().withMessage('Invalid project ID'),

    body('name')
      .trim()
      .notEmpty().withMessage('Key name is required')
      .isLength({ max: 100 }).withMessage('Key name cannot exceed 100 characters'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 300 }).withMessage('Description cannot exceed 300 characters'),

    body('scopes')
      .optional()
      .isArray({ min: 1 }).withMessage('Scopes must be a non-empty array')
      .custom((scopes) => {
        const invalid = scopes.filter((s) => !API_KEY_SCOPES.includes(s));
        if (invalid.length > 0) {
          throw new Error(`Invalid scopes: ${invalid.join(', ')}. Allowed: ${API_KEY_SCOPES.join(', ')}`);
        }
        return true;
      }),

    body('expiresAt')
      .optional()
      .isISO8601().withMessage('expiresAt must be a valid ISO 8601 date')
      .custom((value) => {
        if (new Date(value) <= new Date()) {
          throw new Error('expiresAt must be in the future');
        }
        return true;
      }),

    body('rateLimit.requestsPerMin')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('requestsPerMin must be between 1 and 10000'),

    body('rateLimit.requestsPerDay')
      .optional()
      .isInt({ min: 1, max: 1000000 })
      .withMessage('requestsPerDay must be between 1 and 1,000,000'),
  ],

  /**
   * Shared: MongoDB ObjectId param validator
   */
  mongoId: [
    param('id').isMongoId().withMessage('Invalid key ID'),
  ],

  /**
   * Query param for listing keys by project
   */
  listByProject: [
    query('projectId')
      .notEmpty().withMessage('projectId query param is required')
      .isMongoId().withMessage('Invalid project ID'),
  ],
};
