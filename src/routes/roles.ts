import { Router } from "express";
import { RolesController } from "../controllers/roles";
import { authMiddleware } from "../middleware/auth";
import { requirePermissions } from "../middleware/rbac";
import { validateRequest } from "../middleware/validation";
import {
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
} from "../types/schemas";

export const rolesRouter = Router();

// All routes require authentication
rolesRouter.use(authMiddleware);

/**
 * GET /api/roles
 * List all roles with filtering and pagination
 * Requires: roles:read permission
 */
rolesRouter.get("/", requirePermissions("roles:read"), RolesController.list);

/**
 * POST /api/roles
 * Create a new role
 * Requires: roles:create permission
 */
rolesRouter.post(
  "/",
  requirePermissions("roles:create"),
  validateRequest(createRoleSchema),
  RolesController.create
);

/**
 * GET /api/roles/:id
 * Get role details by ID
 * Requires: roles:read permission
 */
rolesRouter.get(
  "/:id",
  requirePermissions("roles:read"),
  RolesController.getById
);

/**
 * PUT /api/roles/:id
 * Update role details
 * Requires: roles:update permission
 */
rolesRouter.put(
  "/:id",
  requirePermissions("roles:update"),
  validateRequest(updateRoleSchema),
  RolesController.update
);

/**
 * DELETE /api/roles/:id
 * Delete a role (soft delete)
 * Requires: roles:delete permission
 */
rolesRouter.delete(
  "/:id",
  requirePermissions("roles:delete"),
  RolesController.delete
);

/**
 * PUT /api/roles/:id/permissions
 * Assign permissions to a role
 * Requires: roles:assign-permissions permission
 */
rolesRouter.put(
  "/:id/permissions",
  requirePermissions("roles:assign-permissions"),
  validateRequest(assignPermissionsSchema),
  RolesController.assignPermissions
);

/**
 * DELETE /api/roles/:id/permissions/:permissionId
 * Remove a specific permission from a role
 * Requires: roles:assign-permissions permission
 */
rolesRouter.delete(
  "/:id/permissions/:permissionId",
  requirePermissions("roles:assign-permissions"),
  RolesController.removePermission
);

/**
 * GET /api/roles/:id/users
 * Get all users assigned to a specific role
 * Requires: roles:read permission
 */
rolesRouter.get(
  "/:id/users",
  requirePermissions("roles:read"),
  RolesController.getRoleUsers
);
