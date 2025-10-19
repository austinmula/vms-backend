import { Router } from "express";
import { UsersController } from "../controllers/users";
import { authMiddleware } from "../middleware/auth";
import { requirePermissions } from "../middleware/rbac";
import { validateRequest } from "../middleware/validation";
import {
  createUserSchema,
  updateUserSchema,
  assignRolesSchema,
} from "../types/schemas";

export const usersRouter = Router();

// All routes require authentication
usersRouter.use(authMiddleware);

/**
 * GET /api/users
 * List all users with filtering and pagination
 * Requires: users:read permission
 */
usersRouter.get("/", requirePermissions("users:read"), UsersController.list);

/**
 * POST /api/users
 * Create a new system user
 * Requires: users:create permission
 */
usersRouter.post(
  "/",
  requirePermissions("users:create"),
  validateRequest(createUserSchema),
  UsersController.create
);

/**
 * GET /api/users/:id
 * Get user details by ID
 * Requires: users:read permission
 */
usersRouter.get(
  "/:id",
  requirePermissions("users:read"),
  UsersController.getById
);

/**
 * PUT /api/users/:id
 * Update user details
 * Requires: users:update permission
 */
usersRouter.put(
  "/:id",
  requirePermissions("users:update"),
  validateRequest(updateUserSchema),
  UsersController.update
);

/**
 * DELETE /api/users/:id
 * Deactivate a user (soft delete)
 * Requires: users:delete permission
 */
usersRouter.delete(
  "/:id",
  requirePermissions("users:delete"),
  UsersController.deactivate
);

/**
 * PUT /api/users/:id/roles
 * Assign roles to a user
 * Requires: users:assign-roles permission
 */
usersRouter.put(
  "/:id/roles",
  requirePermissions("users:assign-roles"),
  validateRequest(assignRolesSchema),
  UsersController.assignRoles
);

/**
 * DELETE /api/users/:id/roles/:roleId
 * Remove a specific role from a user
 * Requires: users:assign-roles permission
 */
usersRouter.delete(
  "/:id/roles/:roleId",
  requirePermissions("users:assign-roles"),
  UsersController.removeRole
);
