/**
 * @file analytics.routes.js
 *
 * Route Map:
 *   GET /analytics/overview               — cross-project summary stats
 *   GET /analytics/dashboard?projectId=...&days=30 — full project analytics
 *   GET /analytics/snapshots?projectId=...&days=30 — pre-aggregated daily data
 */

import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/overview',   analyticsController.getOverview);
router.get('/dashboard',  analyticsController.getDashboard);
router.get('/snapshots',  analyticsController.getSnapshots);

export default router;
