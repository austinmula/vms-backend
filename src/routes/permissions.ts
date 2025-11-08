import { Router } from "express";
import { PermissionsController } from "../controllers/permissions";
import { authMiddleware } from "../middleware/auth";
import { requirePermissions } from "../middleware/rbac";
import { validateRequest } from "../middleware/validation";
import {
  createPermissionSchema,
  updatePermissionSchema,
} from "../types/schemas";

export const permissionsRouter = Router();

// All routes require authentication
permissionsRouter.use(authMiddleware);

/**
 * GET /api/permissions
 * List all permissions with filtering and pagination
 * Requires: permissions:read permission
 */
permissionsRouter.get(
  "/",
  requirePermissions("permissions:read"),
  PermissionsController.list
);

/**
 * GET /api/permissions/resources
 * Get list of available resources
 * Requires: permissions:read permission
 */
permissionsRouter.get(
  "/resources",
  requirePermissions("permissions:read"),
  PermissionsController.getResources
);

/**
 * GET /api/permissions/actions
 * Get list of available actions
 * Requires: permissions:read permission
 */
permissionsRouter.get(
  "/actions",
  requirePermissions("permissions:read"),
  PermissionsController.getActions
);

/**
 * POST /api/permissions
 * Create a new permission
 * Requires: permissions:create permission
 */
permissionsRouter.post(
  "/",
  requirePermissions("permissions:create"),
  validateRequest(createPermissionSchema),
  PermissionsController.create
);

/**
 * GET /api/permissions/:id
 * Get permission details by ID
 * Requires: permissions:read permission
 */
permissionsRouter.get(
  "/:id",
  requirePermissions("permissions:read"),
  PermissionsController.getById
);

/**
 * PUT /api/permissions/:id
 * Update permission details
 * Requires: permissions:update permission
 */
permissionsRouter.put(
  "/:id",
  requirePermissions("permissions:update"),
  validateRequest(updatePermissionSchema),
  PermissionsController.update
);

/**
 * DELETE /api/permissions/:id
 * Delete a permission
 * Requires: permissions:delete permission
 */
permissionsRouter.delete(
  "/:id",
  requirePermissions("permissions:delete"),
  PermissionsController.delete
);
