import { Request, Response } from "express";
import { and, eq, ilike, or, sql, count } from "drizzle-orm";
import { db } from "../db";
import {
  organizations,
  locations,
  systemUsers,
  employees,
  visits,
  userRoles,
  roles,
} from "../db/schema/tables";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  organizationQuerySchema,
} from "../types/schemas";
import { log } from "../utils/logger";
import { auditLog } from "../utils/auditLog";

/**
 * Helper function to check if user is super admin
 */
async function isSuperAdmin(userId: string): Promise<boolean> {
  const userRoleLinks = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  if (!userRoleLinks.length) return false;

  const userRoleRecords = await db
    .select({ name: roles.name })
    .from(roles)
    .where(
      sql`${roles.id} IN (${sql.join(
        userRoleLinks.map((r) => sql`${r.roleId}`),
        sql`, `
      )})`
    );

  return userRoleRecords.some((r) => r.name === "super_admin");
}

/**
 * Helper function to get user's organization ID
 */
async function getUserOrganizationId(userId: string): Promise<string | null> {
  const user = await db
    .select({ employeeId: systemUsers.employeeId })
    .from(systemUsers)
    .where(eq(systemUsers.id, userId))
    .limit(1);

  if (!user.length || !user[0].employeeId) return null;

  const employee = await db
    .select({ organizationId: employees.organizationId })
    .from(employees)
    .where(eq(employees.id, user[0].employeeId))
    .limit(1);

  return employee.length ? employee[0].organizationId : null;
}

export class OrganizationsController {
  /**
   * List all organizations with filtering and pagination
   * Super admins can see all organizations, regular users only see their own
   */
  static async list(req: Request, res: Response) {
    try {
      const parsed = organizationQuerySchema.parse(req.query);
      const { page = 1, limit = 10, search, subscriptionTier, isActive } = parsed;
      const offset = (page - 1) * limit;

      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check if user is super admin
      const isSuperAdminUser = await isSuperAdmin(userId);

      // Build where conditions
      const conditions = [];

      // If not super admin, restrict to user's organization
      if (!isSuperAdminUser) {
        const userOrgId = await getUserOrganizationId(userId);
        if (!userOrgId) {
          return res.status(403).json({ error: "User not associated with any organization" });
        }
        conditions.push(eq(organizations.id, userOrgId as string));
      }

      // Filter by active status
      if (typeof isActive === "boolean") {
        conditions.push(eq(organizations.isActive, isActive));
      }

      // Filter by subscription tier
      if (subscriptionTier) {
        conditions.push(eq(organizations.subscriptionTier, subscriptionTier));
      }

      // Search by name, slug, or domain
      if (search) {
        conditions.push(
          or(
            ilike(organizations.name, `%${search}%`),
            ilike(organizations.slug, `%${search}%`),
            ilike(organizations.domain, `%${search}%`)
          )!
        );
      }

      // Build query
      let query = db.select().from(organizations);

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      // Execute query with pagination
      const data = await query.limit(limit).offset(offset);

      // Get total count for pagination
      let countQuery = db.select({ count: count() }).from(organizations);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions)) as any;
      }
      const totalResult = await countQuery;
      const total = totalResult[0]?.count || 0;

      return res.json({
        data,
        pagination: {
          page,
          limit,
          total: Number(total),
          pages: Math.ceil(Number(total) / limit),
        },
      });
    } catch (error) {
      log.error("List organizations failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * Get organization by ID with related statistics
   * Users can only view their own organization unless they're super admin
   */
  static async getById(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check if user is super admin
      const isSuperAdminUser = await isSuperAdmin(userId);

      // If not super admin, verify user belongs to this organization
      if (!isSuperAdminUser) {
        const userOrgId = await getUserOrganizationId(userId);
        if (userOrgId !== id) {
          return res.status(403).json({ error: "Access denied to this organization" });
        }
      }

      // Fetch organization
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      if (!org.length) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Get related counts
      const locationCount = await db
        .select({ count: count() })
        .from(locations)
        .where(eq(locations.organizationId, id as string));

      const userCount = await db
        .select({ count: count() })
        .from(employees)
        .where(eq(employees.organizationId, id as string));

      const employeeCount = await db
        .select({ count: count() })
        .from(employees)
        .where(and(eq(employees.organizationId, id as string), eq(employees.isActive, true)));

      return res.json({
        data: {
          ...org[0],
          stats: {
            totalLocations: Number(locationCount[0]?.count || 0),
            totalUsers: Number(userCount[0]?.count || 0),
            totalEmployees: Number(employeeCount[0]?.count || 0),
          },
        },
      });
    } catch (error) {
      log.error("Get organization failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }

  /**
   * Create new organization
   * Only super admins can create organizations
   */
  static async create(req: Request, res: Response) {
    try {
      const body = createOrganizationSchema.parse(req.body);
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check if user is super admin
      const isSuperAdminUser = await isSuperAdmin(userId);
      if (!isSuperAdminUser) {
        return res.status(403).json({ error: "Only super admins can create organizations" });
      }

      // Check for duplicate slug
      const existingSlug = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, body.slug))
        .limit(1);

      if (existingSlug.length) {
        return res.status(409).json({ error: "Organization slug already exists" });
      }

      // Check for duplicate domain if provided
      if (body.domain) {
        const existingDomain = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.domain, body.domain))
          .limit(1);

        if (existingDomain.length) {
          return res.status(409).json({ error: "Organization domain already exists" });
        }
      }

      // Create organization
      const inserted = await db
        .insert(organizations)
        .values({
          name: body.name,
          slug: body.slug,
          domain: body.domain || null,
          address: body.address || null,
          phone: body.phone || null,
          website: body.website || null,
          subscriptionTier: body.subscriptionTier || "basic",
          timezone: body.timezone || "UTC",
          isActive: true,
          isVerified: false,
        })
        .returning();

      const organization = inserted[0];
      if (!organization) {
        return res.status(500).json({ error: "Failed to create organization" });
      }

      // Audit log
      await auditLog.securityEvent(
        "organization_created",
        { organizationId: organization.id, name: organization.name, userId },
        req.ip || "unknown",
        organization.id
      );

      log.info("Organization created", { organizationId: organization.id, userId });

      return res.status(201).json({ data: organization });
    } catch (error) {
      log.error("Create organization failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * Update organization
   * Users can only update their own organization unless they're super admin
   */
  static async update(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const body = updateOrganizationSchema.parse(req.body);
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check if user is super admin
      const isSuperAdminUser = await isSuperAdmin(userId);

      // If not super admin, verify user belongs to this organization
      if (!isSuperAdminUser) {
        const userOrgId = await getUserOrganizationId(userId);
        if (userOrgId !== id) {
          return res.status(403).json({ error: "Access denied to update this organization" });
        }
      }

      // Check if organization exists
      const existing = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      if (!existing.length) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Check for duplicate slug if being updated
      if (body.slug && body.slug !== existing[0].slug) {
        const existingSlug = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.slug, body.slug))
          .limit(1);

        if (existingSlug.length) {
          return res.status(409).json({ error: "Organization slug already exists" });
        }
      }

      // Check for duplicate domain if being updated
      if (body.domain && body.domain !== existing[0].domain) {
        const existingDomain = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.domain, body.domain))
          .limit(1);

        if (existingDomain.length) {
          return res.status(409).json({ error: "Organization domain already exists" });
        }
      }

      // Build update values
      const updateValues: any = {
        updatedAt: new Date(),
      };

      if (body.name !== undefined) updateValues.name = body.name;
      if (body.slug !== undefined) updateValues.slug = body.slug;
      if (body.domain !== undefined) updateValues.domain = body.domain || null;
      if (body.address !== undefined) updateValues.address = body.address || null;
      if (body.phone !== undefined) updateValues.phone = body.phone || null;
      if (body.website !== undefined) updateValues.website = body.website || null;
      if (body.subscriptionTier !== undefined)
        updateValues.subscriptionTier = body.subscriptionTier;
      if (body.timezone !== undefined) updateValues.timezone = body.timezone;

      // Update organization
      const updated = await db
        .update(organizations)
        .set(updateValues)
        .where(eq(organizations.id, id))
        .returning();

      // Audit log
      await auditLog.securityEvent(
        "organization_updated",
        {
          organizationId: id,
          changedFields: Object.keys(body),
          userId,
        },
        req.ip || "unknown",
        id
      );

      log.info("Organization updated", { organizationId: id, userId });

      return res.json({ data: updated[0] });
    } catch (error) {
      log.error("Update organization failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * Soft delete organization
   * Only super admins can delete organizations
   */
  static async delete(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check if user is super admin
      const isSuperAdminUser = await isSuperAdmin(userId);
      if (!isSuperAdminUser) {
        return res.status(403).json({ error: "Only super admins can delete organizations" });
      }

      // Check if organization exists
      const existing = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      if (!existing.length) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Soft delete (set isActive to false)
      await db
        .update(organizations)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(organizations.id, id));

      // Audit log
      await auditLog.securityEvent(
        "organization_deleted",
        { organizationId: id, userId },
        req.ip || "unknown",
        id
      );

      log.info("Organization soft deleted", { organizationId: id, userId });

      return res.status(204).send();
    } catch (error) {
      log.error("Delete organization failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }

  /**
   * Get organization statistics
   * Users can only view stats for their own organization unless they're super admin
   */
  static async getStats(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check if user is super admin
      const isSuperAdminUser = await isSuperAdmin(userId);

      // If not super admin, verify user belongs to this organization
      if (!isSuperAdminUser) {
        const userOrgId = await getUserOrganizationId(userId);
        if (userOrgId !== id) {
          return res.status(403).json({ error: "Access denied to this organization" });
        }
      }

      // Check if organization exists
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      if (!org.length) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Get statistics
      const totalLocations = await db
        .select({ count: count() })
        .from(locations)
        .where(eq(locations.organizationId, id as string));

      const totalEmployees = await db
        .select({ count: count() })
        .from(employees)
        .where(eq(employees.organizationId, id as string));

      const activeEmployees = await db
        .select({ count: count() })
        .from(employees)
        .where(and(eq(employees.organizationId, id as string), eq(employees.isActive, true)));

      // Get system users count (employees with system access)
      const systemUsersCount = await db
        .select({ count: count() })
        .from(systemUsers)
        .innerJoin(employees, eq(systemUsers.employeeId, employees.id))
        .where(eq(employees.organizationId, id as string));

      // Get current month visitors count
      const firstDayOfMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      );
      const currentMonthVisitors = await db
        .select({ count: count() })
        .from(visits)
        .innerJoin(locations, eq(visits.locationId, locations.id))
        .where(
          and(
            eq(locations.organizationId, id),
            sql`${visits.createdAt} >= ${firstDayOfMonth}`
          )
        );

      const stats = {
        totalLocations: Number(totalLocations[0]?.count || 0),
        totalEmployees: Number(totalEmployees[0]?.count || 0),
        activeEmployees: Number(activeEmployees[0]?.count || 0),
        totalUsers: Number(systemUsersCount[0]?.count || 0),
        currentMonthVisitors: Number(currentMonthVisitors[0]?.count || 0),
      };

      return res.json({ data: stats });
    } catch (error) {
      log.error("Get organization stats failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }
}
