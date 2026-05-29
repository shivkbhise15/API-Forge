/**
 * @file log.routes.js
 * @description Request log query routes.
 *
 * Route Map:
 *   GET /logs?projectId=...    — paginated logs for a project
 *   GET /logs/summary?projectId=... — 24h dashboard summary
 *   GET /logs/:id              — single log entry
 */

import { Router } from 'express';
import { logController } from '../controllers/log.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/summary',  logController.getProjectSummary);
router.get('/',         logController.getProjectLogs);
router.get('/:id',      logController.getOne);

export default router;
