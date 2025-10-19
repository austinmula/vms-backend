import { Request, Response } from "express";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../db";
import { systemUsers, roles, userRoles, employees } from "../db/schema/tables";
import { AuthUtils } from "../utils";
import {
  createUserSchema,
  updateUserSchema,
  assignRolesSchema,
  listUsersQuerySchema,
} from "../types/schemas";
import { log } from "../utils/logger";

async function fetchUserWithRoles(userId: string) {
  // Base user
  const user = await db
    .select()
    .from(systemUsers)
    .where(eq(systemUsers.id, userId))
    .limit(1);

  if (user.length === 0) return null;

  const roleLinks = await db
    .select({
      roleId: userRoles.roleId,
    })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  let roleRecords: { id: string; name: string }[] = [];
  if (roleLinks.length) {
    roleRecords = await db
      .select({
        id: roles.id,
        name: roles.name,
      })
      .from(roles)
      .where(
        inArray(
          roles.id,
          roleLinks.map((r) => r.roleId)
        )
      );
  }

  return {
    ...user[0],
    roles: roleRecords,
  };
}

export class UsersController {
  static async list(req: Request, res: Response) {
    try {
      const parsed = listUsersQuerySchema.parse(req.query);
      const { search, role, isActive, limit = 25, offset = 0 } = parsed;

      // Build where conditions
      const conditions = [];
      if (typeof isActive === "boolean") {
        conditions.push(eq(systemUsers.isActive, isActive));
      }

      // Build query with conditions applied before limit/offset
      let baseQuery = db.select().from(systemUsers);

      if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as any;
      }

      let users = await baseQuery.limit(limit).offset(offset);

      // Search filter (simple email / employee match)
      if (search) {
        users = users.filter(
          (u) =>
            u.email.toLowerCase().includes(search.toLowerCase()) ||
            (u.employeeId || "").toLowerCase().includes(search.toLowerCase())
        );
      }

      // Attach roles
      const userIds = users.map((u) => u.id);
      let roleMap: Record<string, { id: string; name: string }[]> = {};

      if (userIds.length) {
        const links = await db
          .select({
            userId: userRoles.userId,
            roleId: userRoles.roleId,
          })
          .from(userRoles)
          .where(inArray(userRoles.userId, userIds));

        const roleIds = [...new Set(links.map((l) => l.roleId))];
        let roleRows: { id: string; name: string }[] = [];
        if (roleIds.length) {
          roleRows = await db
            .select({
              id: roles.id,
              name: roles.name,
            })
            .from(roles)
            .where(inArray(roles.id, roleIds));
        }

        const roleById = Object.fromEntries(roleRows.map((r) => [r.id, r]));

        for (const link of links) {
          if (!roleMap[link.userId]) roleMap[link.userId] = [];
          const rr = roleById[link.roleId];
          if (rr) {
            roleMap[link.userId]!.push(rr);
          }
        }
      }

      let enriched = users.map((u) => ({
        ...u,
        roles: roleMap[u.id] || [],
      }));

      if (role) {
        enriched = enriched.filter((u) => u.roles.some((r) => r.name === role));
      }

      return res.json({
        data: enriched,
        pagination: {
          count: enriched.length,
          limit,
          offset,
        },
      });
    } catch (error) {
      log.error("List users failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const body = createUserSchema.parse(req.body);
      const {
        employeeId,
        email,
        password,
        roleIds = [],
        mfaEnabled = false,
      } = body;

      // Check employee exists
      const emp = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

      if (emp.length === 0) {
        return res.status(400).json({ error: "Employee does not exist" });
      }

      // Unique email
      const existing = await db
        .select({ id: systemUsers.id })
        .from(systemUsers)
        .where(eq(systemUsers.email, email))
        .limit(1);
      if (existing.length) {
        return res.status(409).json({ error: "Email already in use" });
      }

      const passwordHash = await AuthUtils.hashPassword(password);

      const inserted = await db
        .insert(systemUsers)
        .values({
          employeeId,
          email,
          passwordHash,
          saltHash: "", // optional if you store separately
          isActive: true,
          mfaEnabled,
        })
        .returning();

      const user = inserted[0];
      if (!user) {
        return res.status(500).json({ error: "Failed to create user" });
      }

      if (roleIds.length) {
        const roleRows = await db
          .select({ id: roles.id })
          .from(roles)
          .where(inArray(roles.id, roleIds));

        const validRoleIds = roleRows.map((r) => r.id);

        if (validRoleIds.length) {
          await db.insert(userRoles).values(
            validRoleIds.map((roleId) => ({
              userId: user.id,
              roleId,
              assignedBy: req.user?.userId || "system",
            }))
          );
        }
      }

      const full = await fetchUserWithRoles(user.id);
      return res.status(201).json({ data: full });
    } catch (error) {
      log.error("Create user failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const id = req.params.id!;
      const user = await fetchUserWithRoles(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({ data: user });
    } catch (error) {
      log.error("Get user failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = req.params.id!;
      const body = updateUserSchema.parse(req.body);
      const { email, password, mfaEnabled, isActive } = body;

      const existing = await db
        .select({ id: systemUsers.id })
        .from(systemUsers)
        .where(eq(systemUsers.id, id))
        .limit(1);
      if (existing.length === 0)
        return res.status(404).json({ error: "User not found" });

      const updateValues: any = {};
      if (typeof email === "string") updateValues.email = email;
      if (typeof mfaEnabled === "boolean") updateValues.mfaEnabled = mfaEnabled;
      if (typeof isActive === "boolean") updateValues.isActive = isActive;
      if (password) {
        updateValues.passwordHash = await AuthUtils.hashPassword(password);
      }

      if (Object.keys(updateValues).length) {
        await db
          .update(systemUsers)
          .set(updateValues)
          .where(eq(systemUsers.id, id));
      }

      const full = await fetchUserWithRoles(id);
      return res.json({ data: full });
    } catch (error) {
      log.error("Update user failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  static async deactivate(req: Request, res: Response) {
    try {
      const id = req.params.id!;
      const existing = await db
        .select({ id: systemUsers.id })
        .from(systemUsers)
        .where(eq(systemUsers.id, id))
        .limit(1);
      if (!existing.length)
        return res.status(404).json({ error: "User not found" });

      await db
        .update(systemUsers)
        .set({ isActive: false })
        .where(eq(systemUsers.id, id));

      return res.status(204).send();
    } catch (error) {
      log.error("Deactivate user failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }

  static async assignRoles(req: Request, res: Response) {
    try {
      const id = req.params.id!;
      const { roleIds } = assignRolesSchema.parse(req.body);

      const userExists = await db
        .select({ id: systemUsers.id })
        .from(systemUsers)
        .where(eq(systemUsers.id, id))
        .limit(1);
      if (!userExists.length)
        return res.status(404).json({ error: "User not found" });

      const existingLinks = await db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, id));

      const existingSet = new Set(existingLinks.map((r) => r.roleId));

      const newRoleIds = roleIds.filter((r) => !existingSet.has(r));
      if (newRoleIds.length) {
        // Validate roles
        const validRoles = await db
          .select({ id: roles.id })
          .from(roles)
          .where(inArray(roles.id, newRoleIds));

        const validSet = new Set(validRoles.map((r) => r.id));
        const toInsert = newRoleIds
          .filter((r) => validSet.has(r))
          .map((roleId) => ({
            userId: id,
            roleId,
            assignedBy: req.user?.userId || "system",
          }));

        if (toInsert.length) {
          await db.insert(userRoles).values(toInsert);
        }
      }

      const full = await fetchUserWithRoles(id);
      return res.json({ data: full });
    } catch (error) {
      log.error("Assign roles failed", { error });
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  static async removeRole(req: Request, res: Response) {
    try {
      const id = req.params.id!;
      const roleId = req.params.roleId!;
      // Simple delete
      await db
        .delete(userRoles)
        .where(and(eq(userRoles.userId, id), eq(userRoles.roleId, roleId)));
      const full = await fetchUserWithRoles(id);
      return res.json({ data: full });
    } catch (error) {
      log.error("Remove role failed", { error });
      return res.status(500).json({ error: "Internal error" });
    }
  }
}
