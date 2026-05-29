/**
 * @file Project.model.js
 * @description Project (application) schema.
 *
 * Architecture:
 *   A Project is the top-level organizational unit — similar to an "app" in
 *   Firebase, a "project" in GCP, or a "workspace" in Postman.
 *   Each API key belongs to exactly one project.
 *   All request logs and analytics are scoped to a project.
 *
 * Schema Decisions:
 *   - `ownerId`: One-to-many (user → projects). Indexed for dashboard queries.
 *   - `settings.allowedOrigins`: Enforces CORS at the API key level (future feature)
 *   - `settings.rateLimitPerMin`: Per-project rate limit override
 *   - `environment`: Separates dev/staging/prod projects for better organization
 *   - `slug`: URL-safe identifier for future public API endpoints
 *
 * Indexing Strategy:
 *   - `ownerId + isActive`: Primary dashboard query (all active projects for user)
 *   - `ownerId + slug`: Unique constraint (no two projects same slug per user)
 *   - `createdAt`: For admin date-range queries
 *
 * Future:
 *   - Add `members[]` array for team collaboration
 *   - Add `plan` field for billing tiers
 *   - Add `webhookUrl` for outgoing event notifications
 */

import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters'],
      maxlength: [100, 'Project name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: [100, 'Slug cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },

    // ── Ownership ─────────────────────────────────────────────────────────
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Environment ───────────────────────────────────────────────────────
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'development',
    },

    // ── Status ────────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },

    // ── Configuration ─────────────────────────────────────────────────────
    settings: {
      allowedOrigins: {
        type: [String],
        default: ['*'],
      },
      rateLimitPerMin: {
        type: Number,
        default: 60,
        min: 1,
        max: 10000,
      },
    },

    // ── Aggregate Stats (denormalized for fast dashboard reads) ────────────
    stats: {
      totalRequests: { type: Number, default: 0 },
      totalApiKeys: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ── Indexes ───────────────────────────────────────────────────────────────
projectSchema.index({ ownerId: 1, isActive: 1 });          // dashboard: active projects
projectSchema.index({ ownerId: 1, slug: 1 }, { unique: true }); // no duplicate slugs per user
projectSchema.index({ createdAt: -1 });

// ── Pre-save: auto-generate slug from name ─────────────────────────────────
projectSchema.pre('save', function (next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')  // remove special chars
      .replace(/\s+/g, '-')           // spaces → hyphens
      .replace(/-+/g, '-')            // collapse multiple hyphens
      .substring(0, 100);
  }
  next();
});

export const Project = mongoose.model('Project', projectSchema);
