/**
 * @file project.validator.js
 * @description Validation chains for project endpoints.
 */

import { body, param } from 'express-validator';

export const projectValidators = {
  /**
   * POST /projects — create project
   */
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Project name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Project name must be between 2 and 100 characters'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),

    body('environment')
      .optional()
      .isIn(['development', 'staging', 'production'])
      .withMessage('Environment must be one of: development, staging, production'),

    body('settings.rateLimitPerMin')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Rate limit must be between 1 and 10000 requests per minute'),

    body('settings.allowedOrigins')
      .optional()
      .isArray()
      .withMessage('allowedOrigins must be an array'),
  ],

  /**
   * PUT /projects/:id — update project
   */
  update: [
    param('id')
      .isMongoId().withMessage('Invalid project ID'),

    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Project name must be between 2 and 100 characters'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),

    body('environment')
      .optional()
      .isIn(['development', 'staging', 'production'])
      .withMessage('Environment must be one of: development, staging, production'),

    body('settings.rateLimitPerMin')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Rate limit must be between 1 and 10000'),
  ],

  /**
   * Shared: validate MongoDB ObjectId in route param
   */
  mongoId: [
    param('id').isMongoId().withMessage('Invalid project ID'),
  ],
};
