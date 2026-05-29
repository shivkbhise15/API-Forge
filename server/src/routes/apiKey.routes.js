/**
 * @file apiKey.routes.js
 * @description API Key management route definitions.
 *
 * Route Map:
 *   POST   /keys                  — create new key
 *   GET    /keys?projectId=...    — list keys for a project
 *   GET    /keys/:id              — get single key
 *   PATCH  /keys/:id              — update key metadata
 *   PATCH  /keys/:id/revoke       — revoke key (soft-disable)
 *   DELETE /keys/:id              — hard delete (must be revoked first)
 */

import { Router } from 'express';
import { apiKeyController } from '../controllers/apiKey.controller.js';
import { apiKeyValidators } from '../validators/apiKey.validator.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All key management routes require JWT auth
router.use(authenticate);

router.post('/',              apiKeyValidators.create,       validate, apiKeyController.create);
router.get('/',               apiKeyValidators.listByProject, validate, apiKeyController.list);
router.get('/:id',            apiKeyValidators.mongoId,      validate, apiKeyController.getOne);
router.patch('/:id',          apiKeyValidators.mongoId,      validate, apiKeyController.update);
router.patch('/:id/revoke',   apiKeyValidators.mongoId,      validate, apiKeyController.revoke);
router.delete('/:id',         apiKeyValidators.mongoId,      validate, apiKeyController.delete);

export default router;
