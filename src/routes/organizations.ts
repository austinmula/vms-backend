import { Router } from "express";
import { OrganizationsController } from "../controllers/organizations";
import { authMiddleware } from "../middleware/auth";
import { requirePermissions } from "../middleware/rbac";
import { validateRequest } from "../middleware/validation";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from "../types/schemas";

export const organizationsRouter = Router();

// All routes require authentication
organizationsRouter.use(authMiddleware);

/**
 * GET /api/organizations
 * List all organizations with filtering and pagination
 * Requires: organizations:read permission
 * Super admins see all, regular users see only their own
 */
organizationsRouter.get(
  "/",
  requirePermissions("organizations:read"),
  OrganizationsController.list
);

/**
 * POST /api/organizations
 * Create a new organization
 * Requires: organizations:create permission (super admin only)
 */
organizationsRouter.post(
  "/",
  requirePermissions("organizations:create"),
  validateRequest(createOrganizationSchema),
  OrganizationsController.create
);

/**
 * GET /api/organizations/:id
 * Get organization details by ID
 * Requires: organizations:read permission
 * Users can only view their own organization unless super admin
 */
organizationsRouter.get(
  "/:id",
  requirePermissions("organizations:read"),
  OrganizationsController.getById
);

/**
 * PUT /api/organizations/:id
 * Update organization details
 * Requires: organizations:update permission
 * Users can only update their own organization unless super admin
 */
organizationsRouter.put(
  "/:id",
  requirePermissions("organizations:update"),
  validateRequest(updateOrganizationSchema),
  OrganizationsController.update
);

/**
 * DELETE /api/organizations/:id
 * Soft delete an organization
 * Requires: organizations:delete permission (super admin only)
 */
organizationsRouter.delete(
  "/:id",
  requirePermissions("organizations:delete"),
  OrganizationsController.delete
);

/**
 * GET /api/organizations/:id/stats
 * Get organization statistics
 * Requires: organizations:read permission
 * Users can only view stats for their own organization unless super admin
 */
organizationsRouter.get(
  "/:id/stats",
  requirePermissions("organizations:read"),
  OrganizationsController.getStats
);
