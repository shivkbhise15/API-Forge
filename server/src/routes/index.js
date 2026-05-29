/**
 * @file routes/index.js
 * @description Central route aggregator — all versioned routes mounted here.
 */

import { Router } from 'express';
import authRoutes      from './auth.routes.js';
import projectRoutes   from './project.routes.js';
import apiKeyRoutes    from './apiKey.routes.js';
import logRoutes       from './log.routes.js';
import analyticsRoutes from './analytics.routes.js';

const router = Router();

// ── API v1 Route Mounts ───────────────────────────────────────────────────
router.use('/auth',      authRoutes);
router.use('/projects',  projectRoutes);
router.use('/keys',      apiKeyRoutes);
router.use('/logs',      logRoutes);
router.use('/analytics', analyticsRoutes);

// ── v1 root info ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({
    message: 'APIForge API v1',
    endpoints: {
      auth:      '/api/v1/auth',
      projects:  '/api/v1/projects',
      keys:      '/api/v1/keys',
      logs:      '/api/v1/logs',
      analytics: '/api/v1/analytics',
    },
  });
});

export default router;
