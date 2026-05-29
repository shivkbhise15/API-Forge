/**
 * @file ApiResponse.js
 * @description Standardized API response shape.
 *
 * Architecture Decision:
 *   Every API response — success or error — follows the same envelope shape.
 *   This makes frontend integration predictable and enables generic
 *   Axios response interceptors to handle status codes uniformly.
 *
 * Response Shape:
 *   {
 *     success: boolean,
 *     message: string,
 *     data: object | null,
 *     meta: object | null,   // pagination, counts, etc.
 *     errors: array | null,  // validation errors
 *     requestId: string,     // for tracing
 *     timestamp: string,
 *   }
 */

export class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - human-readable message
   * @param {*} data - response payload
   * @param {object|null} meta - optional pagination/metadata
   * @param {string|null} requestId - request trace ID
   */
  constructor(statusCode, message, data = null, meta = null, requestId = null) {
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
    this.meta = meta;
    this.requestId = requestId;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Factory for successful responses.
   */
  static success(message, data = null, meta = null, requestId = null) {
    return new ApiResponse(200, message, data, meta, requestId);
  }

  /**
   * Factory for created responses (201).
   */
  static created(message, data = null, requestId = null) {
    const res = new ApiResponse(201, message, data, null, requestId);
    return res;
  }

  /**
   * Send the response via Express res object.
   * @param {import('express').Response} res
   * @param {number} statusCode
   */
  send(res, statusCode = 200) {
    return res.status(statusCode).json(this);
  }
}
