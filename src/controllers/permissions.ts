import { Request, Response } from "express";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../db";
import { permissions, rolePermissions, roles } from "../db/schema/tables";
import { log } from "../utils/logger";
import { auditLog } from "../utils/auditLog";
import { clearAllPermissionCaches } from "../middleware/rbac";
import {
  createPermissionSchema,
  updatePermissionSchema,
  listPermissionsQuerySchema,
} from "../types/schemas";

export class PermissionsController {
  /**
   * GET /api/permissions
   * List all permissions with filtering and pagination
   */
  static async list(req: Request, res: Response) {
    try {
      const parsed = listPermissionsQuerySchema.parse(req.query);
      const { search, resource, action, isSystemPermission, limit = 100, offset = 0 } = parsed;

      // Build where conditions
      const conditions = [];
      if (typeof isSystemPermission === "boolean") {
        conditions.push(eq(permissions.isSystemPermission, isSystemPermission));
      }
      if (resource) {
        conditions.push(eq(permissions.resource, resource));
      }
      if (action) {
        conditions.push(eq(permissions.action, action));
      }
      if (search) {
        conditions.push(
          or(
            ilike(permissions.name, `%${search}%`),
            ilike(permissions.slug, `%${search}%`),
            ilike(permissions.resource, `%${search}%`),
            ilike(permissions.action, `%${search}%`),
            ilike(permissions.description, `%${search}%`)
          )
        );
      }

      // Build query
      let baseQuery = db.select().from(permissions);

      if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as any;
      }

      const permissionsList = await baseQuery.limit(limit).offset(offset);

      // Get role counts for each permission
      const permissionIds = permissionsList.map((p) => p.id);
      let roleCounts: Record<string, number> = {};

      if (permissionIds.length) {
        const roleLinks = await db
          .select({
            permissionId: rolePermissions.permissionId,
            roleId: rolePermissions.roleId,
          })
          .from(rolePermissions)
          .where(inArray(rolePermissions.permissionId, permissionIds));

        for (const link of roleLinks) {
          roleCounts[link.permissionId] =
            (roleCounts[link.permissionId] || 0) + 1;
        }
      }

      const enriched = permissionsList.map((p) => ({
        ...p,
        roleCount: roleCounts[p.id] || 0,
      }));

      // Count total
      let countQuery = db.select().from(permissions);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions)) as any;
      }
      const totalPermissions = await countQuery;

      return res.json({
        data: enriched,
        pagination: {
          total: totalPermissions.length,
          count: enriched.length,
          limit,
          offset,
        },
      });
    } catch (error) {
      log.error("List permissions failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * POST /api/permissions
   * Create a new permission
   */
  static async create(req: Request, res: Response) {
    try {
      const body = createPermissionSchema.parse(req.body);
      const { name, slug, resource, action, description, isSystemPermission = false } = body;

      // Check if slug already exists
      const existing = await db
        .select({ id: permissions.id })
        .from(permissions)
        .where(eq(permissions.slug, slug))
        .limit(1);

      if (existing.length) {
        return res.status(409).json({
          error: "A permission with this slug already exists",
        });
      }

      // Check if resource:action combination already exists
      const existingCombo = await db
        .select({ id: permissions.id })
        .from(permissions)
        .where(
          and(
            eq(permissions.resource, resource),
            eq(permissions.action, action)
          )
        )
        .limit(1);

      if (existingCombo.length) {
        return res.status(409).json({
          error: `Permission for ${resource}:${action} already exists`,
        });
      }

      // Create permission
      const inserted = await db
        .insert(permissions)
        .values({
          name,
          slug,
          resource,
          action,
          description,
          isSystemPermission,
        })
        .returning();

      const permission = inserted[0];
      if (!permission) {
        return res.status(500).json({ error: "Failed to create permission" });
      }

      // Audit log - use first available organization ID from roles table
      const firstOrg = await db
        .select({ organizationId: roles.organizationId })
        .from(roles)
        .limit(1);

      if (firstOrg.length) {
        await auditLog({
          db,
          organizationId: firstOrg[0].organizationId,
          userId: req.user?.userId || null,
          employeeId: req.user?.employeeId || null,
          action: "create",
          resource: "permissions",
          resourceId: permission.id,
          description: `Created permission: ${name}`,
          newValues: { name, slug, resource, action, description },
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

      // Clear permission caches
      clearAllPermissionCaches();

      return res.status(201).json({ data: permission });
    } catch (error) {
      log.error("Create permission failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * GET /api/permissions/:id
   * Get permission details by ID
   */
  static async getById(req: Request, res: Response) {
    try {
      const id = req.params.id!;

      const permission = await db
        .select()
        .from(permissions)
        .where(eq(permissions.id, id))
        .limit(1);

      if (!permission.length) {
        return res.status(404).json({ error: "Permission not found" });
      }

      // Get roles that have this permission
      const roleLinks = await db
        .select({
          roleId: rolePermissions.roleId,
        })
        .from(rolePermissions)
        .where(eq(rolePermissions.permissionId, id));

      let roleRecords: any[] = [];
      if (roleLinks.length) {
        roleRecords = await db
          .select({
            id: roles.id,
            name: roles.name,
            slug: roles.slug,
            organizationId: roles.organizationId,
          })
          .from(roles)
          .where(
            inArray(
              roles.id,
              roleLinks.map((r) => r.roleId)
            )
          );
      }

      return res.json({
        data: {
          ...permission[0],
          roles: roleRecords,
        },
      });
    } catch (error) {
      log.error("Get permission failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }

  /**
   * PUT /api/permissions/:id
   * Update permission details
   */
  static async update(req: Request, res: Response) {
    try {
      const id = req.params.id!;
      const body = updatePermissionSchema.parse(req.body);
      const { name, description } = body;

      const existing = await db
        .select()
        .from(permissions)
        .where(eq(permissions.id, id))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Permission not found" });
      }

      const permission = existing[0];

      // Prevent updating system permissions (slug, resource, action should not change)
      if (permission.isSystemPermission && req.user?.role !== "super_admin") {
        return res.status(403).json({
          error: "Cannot modify system permissions",
        });
      }

      const updateValues: any = {};
      if (typeof name === "string") updateValues.name = name;
      if (typeof description === "string") updateValues.description = description;

      if (Object.keys(updateValues).length) {
        await db
          .update(permissions)
          .set(updateValues)
          .where(eq(permissions.id, id));

        // Audit log
        const firstOrg = await db
          .select({ organizationId: roles.organizationId })
          .from(roles)
          .limit(1);

        if (firstOrg.length) {
          await auditLog({
            db,
            organizationId: firstOrg[0].organizationId,
            userId: req.user?.userId || null,
            employeeId: req.user?.employeeId || null,
            action: "update",
            resource: "permissions",
            resourceId: id,
            description: `Updated permission: ${permission.name}`,
            oldValues: existing[0],
            newValues: updateValues,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }

        // Clear permission caches
        clearAllPermissionCaches();
      }

      const updated = await db
        .select()
        .from(permissions)
        .where(eq(permissions.id, id))
        .limit(1);

      return res.json({ data: updated[0] });
    } catch (error) {
      log.error("Update permission failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * DELETE /api/permissions/:id
   * Delete a permission
   */
  static async delete(req: Request, res: Response) {
    try {
      const id = req.params.id!;

      const existing = await db
        .select()
        .from(permissions)
        .where(eq(permissions.id, id))
        .limit(1);

      if (!existing.length) {
        return res.status(404).json({ error: "Permission not found" });
      }

      const permission = existing[0];

      // Prevent deleting system permissions
      if (permission.isSystemPermission) {
        return res.status(403).json({
          error: "Cannot delete system permissions",
        });
      }

      // Check if permission is assigned to any roles
      const assignedRoles = await db
        .select({ roleId: rolePermissions.roleId })
        .from(rolePermissions)
        .where(eq(rolePermissions.permissionId, id));

      if (assignedRoles.length > 0) {
        return res.status(400).json({
          error: `Cannot delete permission: ${assignedRoles.length} role(s) have this permission`,
          roleCount: assignedRoles.length,
        });
      }

      // Hard delete since permissions don't have soft delete
      await db.delete(permissions).where(eq(permissions.id, id));

      // Audit log
      const firstOrg = await db
        .select({ organizationId: roles.organizationId })
        .from(roles)
        .limit(1);

      if (firstOrg.length) {
        await auditLog({
          db,
          organizationId: firstOrg[0].organizationId,
          userId: req.user?.userId || null,
          employeeId: req.user?.employeeId || null,
          action: "delete",
          resource: "permissions",
          resourceId: id,
          description: `Deleted permission: ${permission.name}`,
          oldValues: permission,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

      // Clear permission caches
      clearAllPermissionCaches();

      return res.status(204).send();
    } catch (error) {
      log.error("Delete permission failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }

  /**
   * GET /api/permissions/resources
   * Get list of available resources
   */
  static async getResources(req: Request, res: Response) {
    try {
      const resources = await db
        .selectDistinct({ resource: permissions.resource })
        .from(permissions);

      const resourceList = resources.map((r) => r.resource);

      return res.json({ data: resourceList });
    } catch (error) {
      log.error("Get resources failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }

  /**
   * GET /api/permissions/actions
   * Get list of available actions
   */
  static async getActions(req: Request, res: Response) {
    try {
      const actions = await db
        .selectDistinct({ action: permissions.action })
        .from(permissions);

      const actionList = actions.map((a) => a.action);

      return res.json({ data: actionList });
    } catch (error) {
      log.error("Get actions failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }
}
