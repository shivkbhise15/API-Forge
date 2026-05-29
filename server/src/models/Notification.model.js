/**
 * @file Notification.model.js
 * @description In-app user notification schema.
 *
 * Types:
 *   - key_expiring_soon: X days before an API key expires
 *   - rate_limit_warning: key hit 80% of daily quota
 *   - high_error_rate: error rate > threshold for a project
 *   - system: platform announcements
 *
 * Future: Push via Socket.io on creation for real-time in-app alerts.
 */

import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['key_expiring_soon', 'rate_limit_warning', 'high_error_rate', 'system', 'key_revoked'],
      required: true,
    },
    title:   { type: String, required: true, maxlength: 150 },
    message: { type: String, required: true, maxlength: 500 },
    isRead:  { type: Boolean, default: false },
    metadata: {
      projectId: { type: mongoose.Schema.Types.ObjectId, default: null },
      apiKeyId:  { type: mongoose.Schema.Types.ObjectId, default: null },
      link:      { type: String, default: null },
    },
  },
  { timestamps: true, versionKey: false },
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // 90-day TTL

export const Notification = mongoose.model('Notification', notificationSchema);
