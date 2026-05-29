/**
 * @file project.service.js
 * @description Project business logic — CRUD + ownership enforcement.
 *
 * Key Design Decisions:
 *   - All queries are scoped to `ownerId` — users can NEVER access other users' projects
 *   - `assertOwnership()` is a reusable guard used before any mutation
 *   - Soft delete (isActive: false) preferred over hard delete to preserve
 *     referential integrity with api_keys and request_logs
 *   - Stats fields are updated atomically using $inc to avoid race conditions
 */

import { Project } from '../models/Project.model.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { logger } from '../config/logger.js';

class ProjectService {
  /**
   * Create a new project for a user.
   * @param {string} ownerId
   * @param {{ name, description, environment, settings }} dto
   */
  async createProject(ownerId, { name, description, environment, settings }) {
    // Check for duplicate name (case-insensitive) within same user's projects
    const existing = await Project.findOne({
      ownerId,
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (existing) {
      throw new ConflictError(MESSAGES.PROJECT.DUPLICATE_NAME);
    }

    const project = await Project.create({
      name,
      description,
      environment,
      ownerId,
      settings: settings || {},
    });

    logger.info('[ProjectService] Project created:', {
      projectId: project._id,
      ownerId,
    });

    return { project };
  }

  /**
   * List all active projects for a user (paginated).
   * @param {string} ownerId
   * @param {object} query - Express req.query (page, limit)
   */
  async listProjects(ownerId, query) {
    const { page, limit, skip } = parsePagination(query);

    const filter = { ownerId, isActive: true };

    const [projects, total] = await Promise.all([
      Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Project.countDocuments(filter),
    ]);

    return {
      projects,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * Get a single project by ID, scoped to owner.
   * @param {string} projectId
   * @param {string} ownerId
   */
  async getProject(projectId, ownerId) {
    const project = await this.assertOwnership(projectId, ownerId);
    return { project };
  }

  /**
   * Update a project.
   * @param {string} projectId
   * @param {string} ownerId
   * @param {{ name, description, environment, settings, isActive }} dto
   */
  async updateProject(projectId, ownerId, dto) {
    await this.assertOwnership(projectId, ownerId);

    // Prevent duplicate name on update (excluding current doc)
    if (dto.name) {
      const duplicate = await Project.findOne({
        ownerId,
        name: { $regex: new RegExp(`^${dto.name}$`, 'i') },
        _id: { $ne: projectId },
      });
      if (duplicate) throw new ConflictError(MESSAGES.PROJECT.DUPLICATE_NAME);
    }

    const project = await Project.findByIdAndUpdate(
      projectId,
      { $set: dto },
      { new: true, runValidators: true },
    );

    logger.info('[ProjectService] Project updated:', { projectId, ownerId });

    return { project };
  }

  /**
   * Soft-delete a project (sets isActive: false).
   * All associated API keys will be inactive by inheritance (handled in queries).
   * @param {string} projectId
   * @param {string} ownerId
   */
  async deleteProject(projectId, ownerId) {
    await this.assertOwnership(projectId, ownerId);

    await Project.findByIdAndUpdate(projectId, { isActive: false });

    logger.info('[ProjectService] Project soft-deleted:', { projectId, ownerId });
  }

  /**
   * Increment the request counter atomically.
   * Called by the request logging middleware for every proxied request.
   * Uses $inc to avoid lost-update race conditions.
   * @param {string} projectId
   */
  async incrementRequestCount(projectId) {
    await Project.updateOne(
      { _id: projectId },
      { $inc: { 'stats.totalRequests': 1 } },
    );
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Fetch a project and verify ownership. Throws if not found or not owner.
   * Reused as a guard in all mutation methods.
   * @param {string} projectId
   * @param {string} ownerId
   * @returns {Promise<object>} project document
   */
  async assertOwnership(projectId, ownerId) {
    const project = await Project.findOne({ _id: projectId, isActive: true });

    if (!project) {
      throw new NotFoundError(MESSAGES.PROJECT.NOT_FOUND);
    }

    if (project.ownerId.toString() !== ownerId.toString()) {
      throw new ForbiddenError(MESSAGES.AUTH.FORBIDDEN);
    }

    return project;
  }
}

export const projectService = new ProjectService();
