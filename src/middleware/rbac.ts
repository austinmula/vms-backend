import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  userRoles,
  roles,
  rolePermissions,
  permissions,
} from "../db/schema/tables";
import { inArray, eq } from "drizzle-orm";
import { log } from "../utils/logger";

// Simple in-memory cache for permissions (can be replaced with Redis for production)
const permissionCache = new Map<string, Set<string>>();
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Load and cache user permissions
 */
async function loadUserPermissions(userId: string): Promise<Set<string>> {
  // Check cache first
  const cached = permissionCache.get(userId);
  const ts = cacheTimestamps.get(userId);

  if (cached && ts && Date.now() - ts < CACHE_TTL_MS) {
    return cached;
  }

  // Get user's roles
  const roleLinks = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  if (!roleLinks.length) {
    const emptySet = new Set<string>();
    permissionCache.set(userId, emptySet);
    cacheTimestamps.set(userId, Date.now());
    return emptySet;
  }

  const roleIds = roleLinks.map((l) => l.roleId);

  // Get permissions for these roles
  const rolePermRows = await db
    .select({
      permissionSlug: permissions.slug,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(inArray(rolePermissions.roleId, roleIds));

  const permSet = new Set(rolePermRows.map((r) => r.permissionSlug));

  // Cache the permissions
  permissionCache.set(userId, permSet);
  cacheTimestamps.set(userId, Date.now());

  return permSet;
}

/**
 * Clear permission cache for a specific user
 */
export function clearPermissionCache(userId: string) {
  permissionCache.delete(userId);
  cacheTimestamps.delete(userId);
}

/**
 * Clear all permission caches
 */
export function clearAllPermissionCaches() {
  permissionCache.clear();
  cacheTimestamps.clear();
}

/**
 * Middleware to require specific permissions
 */
export function requirePermissions(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user;

      if (!authUser?.userId) {
        log.warn("RBAC check failed: No authenticated user", {
          path: req.path,
        });
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Load user permissions
      const userPermissions = await loadUserPermissions(authUser.userId);

      // Check if user has all required permissions
      const missingPermissions = requiredPermissions.filter(
        (perm) => !userPermissions.has(perm)
      );

      if (missingPermissions.length > 0) {
        log.warn("RBAC check failed: Insufficient permissions", {
          userId: authUser.userId,
          required: requiredPermissions,
          missing: missingPermissions,
          path: req.path,
        });

        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
          missing: missingPermissions,
        });
      }

      // User has all required permissions
      log.debug("RBAC check passed", {
        userId: authUser.userId,
        permissions: requiredPermissions,
        path: req.path,
      });

      return next();
    } catch (error) {
      log.error("RBAC middleware error", { error });
      return res.status(500).json({
        success: false,
        message: "Permission check failed",
      });
    }
  };
}

/**
 * Middleware to require any of the specified permissions (OR logic)
 */
export function requireAnyPermission(...permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user;

      if (!authUser?.userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const userPermissions = await loadUserPermissions(authUser.userId);

      // Check if user has at least one of the required permissions
      const hasPermission = permissions.some((perm) =>
        userPermissions.has(perm)
      );

      if (!hasPermission) {
        log.warn("RBAC check failed: No matching permissions", {
          userId: authUser.userId,
          required: permissions,
          path: req.path,
        });

        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
          required: permissions,
        });
      }

      return next();
    } catch (error) {
      log.error("RBAC middleware error", { error });
      return res.status(500).json({
        success: false,
        message: "Permission check failed",
      });
    }
  };
}

/**
 * Middleware to check if user has a specific role
 */
export function requireRole(...roleNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user;

      if (!authUser?.userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Get user's roles
      const roleLinks = await db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, authUser.userId));

      if (!roleLinks.length) {
        return res.status(403).json({
          success: false,
          message: "No roles assigned",
        });
      }

      const userRoleRecords = await db
        .select({ name: roles.name, slug: roles.slug })
        .from(roles)
        .where(
          inArray(
            roles.id,
            roleLinks.map((r) => r.roleId)
          )
        );

      const hasRole = userRoleRecords.some(
        (role) => roleNames.includes(role.name) || roleNames.includes(role.slug)
      );

      if (!hasRole) {
        log.warn("RBAC check failed: Missing required role", {
          userId: authUser.userId,
          requiredRoles: roleNames,
          path: req.path,
        });

        return res.status(403).json({
          success: false,
          message: "Required role not assigned",
          requiredRoles: roleNames,
        });
      }

      return next();
    } catch (error) {
      log.error("Role check middleware error", { error });
      return res.status(500).json({
        success: false,
        message: "Role check failed",
      });
    }
  };
}
