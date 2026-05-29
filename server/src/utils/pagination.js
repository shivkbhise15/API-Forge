/**
 * @file pagination.js
 * @description Cursor-based and offset-based pagination helpers.
 *
 * Design:
 *   Offset pagination is simple and works well for small datasets.
 *   Cursor-based pagination scales to millions of records (no SKIP cost).
 *
 *   For request logs (high volume), cursor pagination is preferred.
 *   For projects/API keys (small sets), offset pagination is fine.
 */

/**
 * Parse pagination params from query string.
 * @param {object} query - Express req.query
 * @returns {{ page, limit, skip }}
 */
export const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Build pagination meta for response envelope.
 * @param {number} total - total document count
 * @param {number} page - current page
 * @param {number} limit - items per page
 * @returns {object} pagination meta
 */
export const buildPaginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

/**
 * Parse cursor-based pagination params.
 * @param {object} query - Express req.query
 * @returns {{ limit, cursor }}
 */
export const parseCursorPagination = (query) => ({
  limit: Math.min(100, Math.max(1, parseInt(query.limit) || 50)),
  cursor: query.cursor || null, // ISO date string or ObjectId
});
