/**
 * @file validate.middleware.js
 * @description express-validator result runner middleware.
 *
 * Architecture Decision:
 *   This middleware is the bridge between express-validator rule chains
 *   (defined in validators/) and the error handler.
 *
 *   Instead of calling validationResult() in every controller, define
 *   validation rules in the validator file, then append `validate` as
 *   the last middleware before the controller. Any validation errors
 *   are thrown as ValidationError (which the error handler catches).
 *
 * Usage:
 *   router.post('/register', authValidators.register, validate, authController.register);
 */

import { validationResult } from 'express-validator';
import { ValidationError } from '../utils/ApiError.js';

/**
 * Runs after express-validator chains. Throws ValidationError if any
 * validation rules failed, halting the request before it reaches the controller.
 */
export const validate = (req, res, next) => {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    // Map errors to a consistent { field, message } shape
    const errors = result.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value !== undefined ? String(err.value) : undefined,
    }));

    throw new ValidationError(errors);
  }

  next();
};
