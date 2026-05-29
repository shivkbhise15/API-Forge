/**
 * @file roles.js
 * @description Role definitions for Role-Based Access Control (RBAC).
 *
 * Design:
 *   Centralized role registry prevents string literals scattered across
 *   middleware and controllers. Add new roles here; RBAC middleware
 *   reads from this file.
 *
 * Future:
 *   Extend with fine-grained permissions per resource (ABAC pattern)
 *   e.g., { resource: 'api_keys', action: 'delete', roles: [ADMIN] }
 */

export const ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
});

/** Ordered role hierarchy (higher index = more privileges) */
export const ROLE_HIERARCHY = [ROLES.USER, ROLES.ADMIN];
