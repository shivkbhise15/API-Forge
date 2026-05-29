/**
 * @file AuditLog.model.js
 * @description Immutable audit trail for all sensitive user actions.
 *
 * Design — Append-Only:
 *   Audit logs are NEVER updated or deleted by application code.
 *   Only the TTL index can remove them (after 1 year).
 *   This creates a tamper-evident record for compliance/security review.
 *
 * Examples of audited actions:
 *   - user.login, user.logout, user.password_reset
 *   - apiKey.created, apiKey.revoked, apiKey.deleted
 *   - project.created, project.deleted
 *   - user.role_changed (admin action)
 *
 * Usage in services:
 *   auditLogService.log({ userId, action: 'apiKey.revoked', resourceId: keyId, ... })
 *   Call this fire-and-forget — don't block the main action on audit write.
 */

import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      // Format: 'resource.verb' — e.g., 'apiKey.revoked', 'user.login'
    },
    resourceType: {
      type: String,
      enum: ['user', 'project', 'apiKey', 'requestLog', 'analytics'],
      required: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    changes: {
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after:  { type: mongoose.Schema.Types.Mixed, default: null },
    },
    ipAddress: { type: String, default: null },
    userAgent:  { type: String, maxlength: 512, default: null },
    metadata:   { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// TTL: auto-purge after 1 year
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
