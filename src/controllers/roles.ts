import { Request, Response } from "express";
import { and, eq, inArray, ilike, or } from "drizzle-orm";
import { db } from "../db";
import {
  roles,
  rolePermissions,
  permissions,
  userRoles,
  systemUsers,
} from "../db/schema/tables";
import { log } from "../utils/logger";
import { auditLog } from "../utils/auditLog";
import { clearAllPermissionCaches } from "../middleware/rbac";
import {
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
  listRolesQuerySchema,
} from "../types/schemas";

/**
 * Fetch role with its permissions
 */
async function fetchRoleWithPermissions(roleId: string) {
  const role = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);

  if (role.length === 0) return null;

  const permissionLinks = await db
    .select({
      permissionId: rolePermissions.permissionId,
    })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));

  let permissionRecords: any[] = [];
  if (permissionLinks.length) {
    permissionRecords = await db
      .select({
        id: permissions.id,
        name: permissions.name,
        slug: permissions.slug,
        resource: permissions.resource,
        action: permissions.action,
        description: permissions.description,
      })
      .from(permissions)
      .where(
        inArray(
          permissions.id,
          permissionLinks.map((p) => p.permissionId)
        )
      );
  }

  return {
    ...role[0],
    permissions: permissionRecords,
  };
}

export class RolesController {
  /**
   * GET /api/roles
   * List all roles with filtering and pagination
   */
  static async list(req: Request, res: Response) {
    try {
      const parsed = listRolesQuerySchema.parse(req.query);
      const {
        search,
        isActive,
        isSystemRole,
        organizationId,
        limit = 25,
        offset = 0,
      } = parsed;

      // Build where conditions
      const conditions = [];
      if (typeof isActive === "boolean") {
        conditions.push(eq(roles.isActive, isActive));
      }
      if (typeof isSystemRole === "boolean") {
        conditions.push(eq(roles.isSystemRole, isSystemRole));
      }
      if (organizationId) {
        conditions.push(eq(roles.organizationId, organizationId));
      }
      if (search) {
        conditions.push(
          or(
            ilike(roles.name, `%${search}%`),
            ilike(roles.slug, `%${search}%`),
            ilike(roles.description, `%${search}%`)
          )
        );
      }

      // Build query
      let baseQuery = db.select().from(roles);

      if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as any;
      }

      const rolesList = await baseQuery.limit(limit).offset(offset);

      // Get permission counts for each role
      const roleIds = rolesList.map((r) => r.id);
      let permissionCounts: Record<string, number> = {};

      if (roleIds.length) {
        const permLinks = await db
          .select({
            roleId: rolePermissions.roleId,
            permissionId: rolePermissions.permissionId,
          })
          .from(rolePermissions)
          .where(inArray(rolePermissions.roleId, roleIds));

        for (const link of permLinks) {
          permissionCounts[link.roleId] =
            (permissionCounts[link.roleId] || 0) + 1;
        }
      }

      const enriched = rolesList.map((r) => ({
        ...r,
        permissionCount: permissionCounts[r.id] || 0,
      }));

      // Count total
      let countQuery = db.select().from(roles);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions)) as any;
      }
      const totalRoles = await countQuery;

      return res.json({
        data: enriched,
        pagination: {
          total: totalRoles.length,
          count: enriched.length,
          limit,
          offset,
        },
      });
    } catch (error) {
      log.error("List roles failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * POST /api/roles
   * Create a new role
   */
  static async create(req: Request, res: Response) {
    try {
      const body = createRoleSchema.parse(req.body);
      const {
        name,
        slug,
        description,
        organizationId,
        isSystemRole = false,
        permissionIds = [],
      } = body;

      // Check if slug already exists in this organization
      const existing = await db
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(eq(roles.slug, slug), eq(roles.organizationId, organizationId))
        )
        .limit(1);

      if (existing.length) {
        return res.status(409).json({
          error: "A role with this slug already exists in the organization",
        });
      }

      // Create role
      const inserted = await db
        .insert(roles)
        .values({
          name,
          slug,
          description,
          organizationId,
          isSystemRole,
          isActive: true,
          createdBy: req.user?.employeeId || null,
        })
        .returning();

      const role = inserted[0];
      if (!role) {
        return res.status(500).json({ error: "Failed to create role" });
      }

      // Assign permissions if provided
      if (permissionIds.length) {
        const validPermissions = await db
          .select({ id: permissions.id })
          .from(permissions)
          .where(inArray(permissions.id, permissionIds));

        const validSet = new Set(validPermissions.map((p) => p.id));
        const toInsert = permissionIds
          .filter((pid) => validSet.has(pid))
          .map((permissionId) => ({
            roleId: role.id,
            permissionId,
            createdBy: req.user?.employeeId || null,
          }));

        if (toInsert.length) {
          await db.insert(rolePermissions).values(toInsert);
        }
      }

      // Audit log
      await auditLog({
        db,
        organizationId,
        userId: req.user?.userId || null,
        employeeId: req.user?.employeeId || null,
        action: "create",
        resource: "roles",
        resourceId: role.id,
        description: `Created role: ${name}`,
        newValues: { name, slug, description },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Clear permission caches
      clearAllPermissionCaches();

      const full = await fetchRoleWithPermissions(role.id);
      return res.status(201).json({ data: full });
    } catch (error) {
      log.error("Create role failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * GET /api/roles/:id
   * Get role details by ID
   */
  static async getById(req: Request, res: Response) {
    try {
      const id = req.params.id!;
      const role = await fetchRoleWithPermissions(id);

      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }

      // Get user count for this role
      const userCount = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(eq(userRoles.roleId, id));

      return res.json({
        data: {
          ...role,
          userCount: userCount.length,
        },
      });
    } catch (error) {
      log.error("Get role failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }

  /**
   * PUT /api/roles/:id
   * Update role details
   */
  static async update(req: Request, res: Response) {
    try {
      const id = req.params.id!;
      const body = updateRoleSchema.parse(req.body);
      const { name, description, isActive } = body;

      const existing = await db
        .select()
        .from(roles)
        .where(eq(roles.id, id))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Role not found" });
      }

      const role = existing[0];

      // Prevent updating system roles
      if (role.isSystemRole && req.user?.role !== "super_admin") {
        return res.status(403).json({
          error: "Cannot modify system roles",
        });
      }

      const updateValues: any = {};
      if (typeof name === "string") updateValues.name = name;
      if (typeof description === "string") updateValues.description = description;
      if (typeof isActive === "boolean") updateValues.isActive = isActive;

      if (Object.keys(updateValues).length) {
        await db.update(roles).set(updateValues).where(eq(roles.id, id));

        // Audit log
        await auditLog({
          db,
          organizationId: role.organizationId,
          userId: req.user?.userId || null,
          employeeId: req.user?.employeeId || null,
          action: "update",
          resource: "roles",
          resourceId: id,
          description: `Updated role: ${role.name}`,
          oldValues: existing[0],
          newValues: updateValues,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        // Clear permission caches
        clearAllPermissionCaches();
      }

      const full = await fetchRoleWithPermissions(id);
      return res.json({ data: full });
    } catch (error) {
      log.error("Update role failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * DELETE /api/roles/:id
   * Delete a role (soft delete)
   */
  static async delete(req: Request, res: Response) {
    try {
      const id = req.params.id!;

      const existing = await db
        .select()
        .from(roles)
        .where(eq(roles.id, id))
        .limit(1);

      if (!existing.length) {
        return res.status(404).json({ error: "Role not found" });
      }

      const role = existing[0];

      // Prevent deleting system roles
      if (role.isSystemRole) {
        return res.status(403).json({
          error: "Cannot delete system roles",
        });
      }

      // Check if role is assigned to users
      const assignedUsers = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(eq(userRoles.roleId, id));

      if (assignedUsers.length > 0) {
        return res.status(400).json({
          error: `Cannot delete role: ${assignedUsers.length} user(s) are assigned to this role`,
          userCount: assignedUsers.length,
        });
      }

      // Soft delete by setting isActive to false
      await db.update(roles).set({ isActive: false }).where(eq(roles.id, id));

      // Audit log
      await auditLog({
        db,
        organizationId: role.organizationId,
        userId: req.user?.userId || null,
        employeeId: req.user?.employeeId || null,
        action: "delete",
        resource: "roles",
        resourceId: id,
        description: `Deleted role: ${role.name}`,
        oldValues: role,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Clear permission caches
      clearAllPermissionCaches();

      return res.status(204).send();
    } catch (error) {
      log.error("Delete role failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }

  /**
   * PUT /api/roles/:id/permissions
   * Assign permissions to a role
   */
  static async assignPermissions(req: Request, res: Response) {
    try {
      const id = req.params.id!;
      const { permissionIds } = assignPermissionsSchema.parse(req.body);

      const roleExists = await db
        .select()
        .from(roles)
        .where(eq(roles.id, id))
        .limit(1);

      if (!roleExists.length) {
        return res.status(404).json({ error: "Role not found" });
      }

      const role = roleExists[0];

      // Prevent modifying system role permissions
      if (role.isSystemRole && req.user?.role !== "super_admin") {
        return res.status(403).json({
          error: "Cannot modify system role permissions",
        });
      }

      // Get existing permissions
      const existingLinks = await db
        .select({ permissionId: rolePermissions.permissionId })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, id));

      const existingSet = new Set(existingLinks.map((p) => p.permissionId));

      // Find new permissions to add
      const newPermissionIds = permissionIds.filter((p) => !existingSet.has(p));

      if (newPermissionIds.length) {
        // Validate permissions
        const validPermissions = await db
          .select({ id: permissions.id })
          .from(permissions)
          .where(inArray(permissions.id, newPermissionIds));

        const validSet = new Set(validPermissions.map((p) => p.id));
        const toInsert = newPermissionIds
          .filter((pid) => validSet.has(pid))
          .map((permissionId) => ({
            roleId: id,
            permissionId,
            createdBy: req.user?.employeeId || null,
          }));

        if (toInsert.length) {
          await db.insert(rolePermissions).values(toInsert);
        }
      }

      // Audit log
      await auditLog({
        db,
        organizationId: role.organizationId,
        userId: req.user?.userId || null,
        employeeId: req.user?.employeeId || null,
        action: "update",
        resource: "roles",
        resourceId: id,
        description: `Assigned permissions to role: ${role.name}`,
        newValues: { permissionIds },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Clear permission caches
      clearAllPermissionCaches();

      const full = await fetchRoleWithPermissions(id);
      return res.json({ data: full });
    } catch (error) {
      log.error("Assign permissions failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * DELETE /api/roles/:id/permissions/:permissionId
   * Remove a specific permission from a role
   */
  static async removePermission(req: Request, res: Response) {
    try {
      const id = req.params.id!;
      const permissionId = req.params.permissionId!;

      const roleExists = await db
        .select()
        .from(roles)
        .where(eq(roles.id, id))
        .limit(1);

      if (!roleExists.length) {
        return res.status(404).json({ error: "Role not found" });
      }

      const role = roleExists[0];

      // Prevent modifying system role permissions
      if (role.isSystemRole && req.user?.role !== "super_admin") {
        return res.status(403).json({
          error: "Cannot modify system role permissions",
        });
      }

      await db
        .delete(rolePermissions)
        .where(
          and(
            eq(rolePermissions.roleId, id),
            eq(rolePermissions.permissionId, permissionId)
          )
        );

      // Audit log
      await auditLog({
        db,
        organizationId: role.organizationId,
        userId: req.user?.userId || null,
        employeeId: req.user?.employeeId || null,
        action: "update",
        resource: "roles",
        resourceId: id,
        description: `Removed permission from role: ${role.name}`,
        oldValues: { permissionId },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Clear permission caches
      clearAllPermissionCaches();

      const full = await fetchRoleWithPermissions(id);
      return res.json({ data: full });
    } catch (error) {
      log.error("Remove permission failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }

  /**
   * GET /api/roles/:id/users
   * Get all users assigned to a specific role
   */
  static async getRoleUsers(req: Request, res: Response) {
    try {
      const id = req.params.id!;

      const roleExists = await db
        .select()
        .from(roles)
        .where(eq(roles.id, id))
        .limit(1);

      if (!roleExists.length) {
        return res.status(404).json({ error: "Role not found" });
      }

      // Get users with this role
      const userLinks = await db
        .select({
          userId: userRoles.userId,
          assignedAt: userRoles.assignedAt,
        })
        .from(userRoles)
        .where(eq(userRoles.roleId, id));

      if (!userLinks.length) {
        return res.json({ data: [] });
      }

      const userIds = userLinks.map((u) => u.userId);
      const users = await db
        .select({
          id: systemUsers.id,
          email: systemUsers.email,
          isActive: systemUsers.isActive,
        })
        .from(systemUsers)
        .where(inArray(systemUsers.id, userIds));

      // Merge with assignedAt
      const enriched = users.map((u) => {
        const link = userLinks.find((l) => l.userId === u.id);
        return {
          ...u,
          assignedAt: link?.assignedAt,
        };
      });

      return res.json({ data: enriched });
    } catch (error) {
      log.error("Get role users failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }
}
