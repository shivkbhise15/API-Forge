/**
 * @file project.routes.js
 * @description Project route definitions.
 *
 * All routes require JWT authentication.
 * Ownership check is handled inside the service layer (not middleware),
 * which keeps route definitions clean while still enforcing authorization.
 *
 * Route Map:
 *   POST   /projects         — create project
 *   GET    /projects         — list user's projects (paginated)
 *   GET    /projects/:id     — get single project
 *   PUT    /projects/:id     — update project
 *   DELETE /projects/:id     — soft-delete project
 */

import { Router } from 'express';
import { projectController } from '../controllers/project.controller.js';
import { projectValidators } from '../validators/project.validator.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All project routes require authentication
router.use(authenticate);

router.post('/',    projectValidators.create,  validate, projectController.create);
router.get('/',                                          projectController.list);
router.get('/:id',  projectValidators.mongoId, validate, projectController.getOne);
router.put('/:id',  projectValidators.update,  validate, projectController.update);
router.delete('/:id', projectValidators.mongoId, validate, projectController.delete);

export default router;
