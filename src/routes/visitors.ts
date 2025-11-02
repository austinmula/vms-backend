import { Router } from "express";
import { VisitorsController } from "../controllers/visitors";
import { authMiddleware } from "../middleware/auth";
import { requirePermissions } from "../middleware/rbac";
import { validateRequest } from "../middleware/validation";
import {
  createVisitorSchema,
  updateVisitorSchema,
} from "../types/schemas";

export const visitorsRouter = Router();

// All routes require authentication
visitorsRouter.use(authMiddleware);

/**
 * GET /api/visitors
 * List all visitors with filtering and pagination
 * Requires: visitors:read permission
 */
visitorsRouter.get(
  "/",
  requirePermissions("visitors:read"),
  VisitorsController.list
);

/**
 * POST /api/visitors
 * Create a new visitor
 * Requires: visitors:create permission
 */
visitorsRouter.post(
  "/",
  requirePermissions("visitors:create"),
  validateRequest(createVisitorSchema),
  VisitorsController.create
);

/**
 * GET /api/visitors/:id
 * Get visitor details by ID
 * Requires: visitors:read permission
 */
visitorsRouter.get(
  "/:id",
  requirePermissions("visitors:read"),
  VisitorsController.getById
);

/**
 * GET /api/visitors/:id/visits
 * Get visitor visit history
 * Requires: visitors:read permission
 */
visitorsRouter.get(
  "/:id/visits",
  requirePermissions("visitors:read"),
  VisitorsController.getVisitHistory
);

/**
 * PUT /api/visitors/:id
 * Update visitor details
 * Requires: visitors:update permission
 */
visitorsRouter.put(
  "/:id",
  requirePermissions("visitors:update"),
  validateRequest(updateVisitorSchema),
  VisitorsController.update
);

/**
 * DELETE /api/visitors/:id
 * Soft delete visitor (mark as blacklisted)
 * Requires: visitors:delete permission
 */
visitorsRouter.delete(
  "/:id",
  requirePermissions("visitors:delete"),
  VisitorsController.softDelete
);

/**
 * POST /api/visitors/:id/blacklist
 * Blacklist a visitor
 * Requires: visitors:blacklist permission
 */
visitorsRouter.post(
  "/:id/blacklist",
  requirePermissions("visitors:blacklist"),
  VisitorsController.blacklist
);

/**
 * DELETE /api/visitors/:id/blacklist
 * Remove visitor from blacklist
 * Requires: visitors:blacklist permission
 */
visitorsRouter.delete(
  "/:id/blacklist",
  requirePermissions("visitors:blacklist"),
  VisitorsController.removeFromBlacklist
);
