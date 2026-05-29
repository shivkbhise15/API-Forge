/**
 * @file apiKey.service.js
 * @description API Key management — generation, validation, CRUD, usage tracking.
 *
 * The most security-sensitive service in the codebase.
 *
 * Key operations:
 *   createKey   — generate, hash, and store a new API key
 *   validateKey — the hot path (called on EVERY API request using a key)
 *   listKeys    — paginated list (hashes never returned)
 *   revokeKey   — soft-disable (isActive: false)
 *   deleteKey   — hard delete (only if already revoked)
 *   trackUsage  — async update of lastUsedAt + totalRequests (fire-and-forget)
 *
 * Performance:
 *   validateKey is intentionally lean — indexed prefix lookup + in-memory hash.
 *   It's designed to add <1ms overhead to proxied requests.
 *   Future: add Redis cache layer so validated keys skip the DB entirely.
 */

import { ApiKey } from '../models/ApiKey.model.js';
import { Project } from '../models/Project.model.js';
import {
  generateApiKey,
  extractKeyPrefix,
  hashToken,
  timingSafeCompare,
} from '../utils/cryptoUtils.js';
import {
  NotFoundError,
  ForbiddenError,
  ApiError,
} from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { logger } from '../config/logger.js';

class ApiKeyService {
  /**
   * Generate and store a new API key for a project.
   *
   * IMPORTANT: The `fullKey` is returned ONCE and never stored.
   * After this response, the key cannot be recovered — only revoked.
   *
   * @param {string} userId
   * @param {string} projectId
   * @param {{ name, description, scopes, expiresAt, rateLimit }} dto
   * @returns {{ apiKey, fullKey }} — fullKey shown ONCE to user
   */
  async createKey(userId, projectId, { name, description, scopes, expiresAt, rateLimit }) {
    // Verify project exists and belongs to this user
    const project = await Project.findOne({ _id: projectId, ownerId: userId, isActive: true });
    if (!project) {
      throw new NotFoundError(MESSAGES.PROJECT.NOT_FOUND);
    }

    // Generate the key — get prefix and hash
    const { fullKey, prefix, keyHash } = generateApiKey();

    const apiKey = await ApiKey.create({
      name,
      description,
      projectId,
      userId,
      keyPrefix: prefix,
      keyHash,
      scopes: scopes || ['read'],
      expiresAt: expiresAt || null,
      rateLimit: rateLimit || {},
    });

    // Increment project's key count
    await Project.updateOne({ _id: projectId }, { $inc: { 'stats.totalApiKeys': 1 } });

    logger.info('[ApiKeyService] API key created:', {
      keyId: apiKey._id,
      projectId,
      userId,
      prefix,
    });

    // Return apiKey document (no hash) + fullKey (shown once)
    return { apiKey, fullKey };
  }

  /**
   * Validate an incoming API key on a proxied request.
   * This is the HOT PATH — optimized for speed and security.
   *
   * @param {string} rawKey - the full key from the X-API-Key header
   * @returns {{ apiKey, project }} - populated key + project documents
   * @throws {ApiError} on invalid, expired, or revoked key
   */
  async validateKey(rawKey) {
    // Step 1: Extract prefix for indexed lookup
    const prefix = extractKeyPrefix(rawKey);
    if (!prefix) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.API_KEY.INVALID);
    }

    // Step 2: Find candidate keys by prefix (could be >1 in theory)
    const candidates = await ApiKey.find({ keyPrefix: prefix })
      .select('+keyHash') // must explicitly select — has select: false
      .populate('projectId', 'isActive settings.rateLimitPerMin ownerId');

    if (!candidates.length) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.API_KEY.INVALID);
    }

    // Step 3: Hash the incoming key and find a match
    const incomingHash = hashToken(rawKey);
    const apiKey = candidates.find(
      (k) => timingSafeCompare(incomingHash, k.keyHash),
    );

    if (!apiKey) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.API_KEY.INVALID);
    }

    // Step 4: Check active status
    if (!apiKey.isActive) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.API_KEY.INVALID);
    }

    // Step 5: Check expiration
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.API_KEY.EXPIRED);
    }

    // Step 6: Check project is still active
    if (!apiKey.projectId?.isActive) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.API_KEY.INVALID);
    }

    return { apiKey, project: apiKey.projectId };
  }

  /**
   * List all API keys for a project (paginated). Hashes are never returned.
   * @param {string} projectId
   * @param {string} userId
   * @param {object} query
   */
  async listKeys(projectId, userId, query) {
    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, ownerId: userId });
    if (!project) throw new NotFoundError(MESSAGES.PROJECT.NOT_FOUND);

    const { page, limit, skip } = parsePagination(query);
    const filter = { projectId, isActive: true };

    const [keys, total] = await Promise.all([
      ApiKey.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ApiKey.countDocuments(filter),
    ]);

    return { keys, meta: buildPaginationMeta(total, page, limit) };
  }

  /**
   * Get a single API key (ownership verified).
   */
  async getKey(keyId, userId) {
    const apiKey = await this.assertOwnership(keyId, userId);
    return { apiKey };
  }

  /**
   * Revoke (soft-disable) an API key.
   * Revoked keys immediately fail validation without being deleted.
   * This preserves historical request log references.
   */
  async revokeKey(keyId, userId) {
    await this.assertOwnership(keyId, userId);

    await ApiKey.findByIdAndUpdate(keyId, { isActive: false });

    logger.info('[ApiKeyService] API key revoked:', { keyId, userId });
  }

  /**
   * Hard delete a key. Only allowed after revocation.
   */
  async deleteKey(keyId, userId) {
    const apiKey = await this.assertOwnership(keyId, userId);

    if (apiKey.isActive) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Revoke the API key before deleting it.',
      );
    }

    await ApiKey.findByIdAndDelete(keyId);

    logger.info('[ApiKeyService] API key deleted:', { keyId, userId });
  }

  /**
   * Update API key metadata (name, description, rateLimit).
   * Scopes and keyHash cannot be updated — revoke + create a new key.
   */
  async updateKey(keyId, userId, { name, description, rateLimit, expiresAt }) {
    await this.assertOwnership(keyId, userId);

    const apiKey = await ApiKey.findByIdAndUpdate(
      keyId,
      { $set: { name, description, rateLimit, expiresAt } },
      { new: true, runValidators: true },
    );

    return { apiKey };
  }

  /**
   * Fire-and-forget usage tracking.
   * Called after a validated request completes. Uses $inc for atomicity.
   * Non-blocking — errors are swallowed (don't fail the user's request).
   */
  trackUsage(keyId) {
    ApiKey.updateOne(
      { _id: keyId },
      {
        $inc: { totalRequests: 1 },
        $set: { lastUsedAt: new Date() },
      },
    ).catch((err) =>
      logger.error('[ApiKeyService] Usage tracking failed:', { error: err.message }),
    );
  }

  // ── Private ─────────────────────────────────────────────────────────────

  async assertOwnership(keyId, userId) {
    const apiKey = await ApiKey.findById(keyId);
    if (!apiKey) throw new NotFoundError(MESSAGES.API_KEY.NOT_FOUND);
    if (apiKey.userId.toString() !== userId.toString()) {
      throw new ForbiddenError(MESSAGES.AUTH.FORBIDDEN);
    }
    return apiKey;
  }
}

export const apiKeyService = new ApiKeyService();
