import { db } from "../db";
import { auditLogs } from "../db/schema/tables";
import { log } from "./logger";

/**
 * Audit logging utility for tracking system events
 */
export class AuditLog {
  /**
   * Log a security event
   */
  async securityEvent(
    eventType: string,
    metadata: Record<string, any>,
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId: metadata.userId || null,
        action: "create", // Map to valid enum value
        resource: "security",
        resourceId: null,
        description: eventType,
        metadata: metadata as any,
        ipAddress,
        userAgent: null,
      });

      log.info("Security event logged", { eventType, metadata });
    } catch (error) {
      log.error("Failed to log security event", { error, eventType });
    }
  }

  /**
   * Log user creation
   */
  async userCreated(
    userId: string,
    createdBy: string,
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId: createdBy,
        action: "create",
        resource: "user",
        resourceId: userId,
        description: "User created",
        metadata: { createdUserId: userId } as any,
        ipAddress,
        userAgent: null,
      });

      log.info("User created event logged", { userId, createdBy });
    } catch (error) {
      log.error("Failed to log user creation", { error });
    }
  }

  /**
   * Log user update
   */
  async userUpdated(
    userId: string,
    updatedBy: string,
    changedFields: string[],
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId: updatedBy,
        action: "update",
        resource: "user",
        resourceId: userId,
        description: "User updated",
        metadata: { changedFields } as any,
        ipAddress,
        userAgent: null,
      });

      log.info("User updated event logged", {
        userId,
        updatedBy,
        changedFields,
      });
    } catch (error) {
      log.error("Failed to log user update", { error });
    }
  }

  /**
   * Log user deactivation
   */
  async userDeactivated(
    userId: string,
    deactivatedBy: string,
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId: deactivatedBy,
        action: "delete", // Use 'delete' instead of 'deactivate'
        resource: "user",
        resourceId: userId,
        description: "User deactivated",
        metadata: {} as any,
        ipAddress,
        userAgent: null,
      });

      log.info("User deactivated event logged", { userId, deactivatedBy });
    } catch (error) {
      log.error("Failed to log user deactivation", { error });
    }
  }

  /**
   * Log role assignments
   */
  async rolesAssigned(
    userId: string,
    roleIds: string[],
    assignedBy: string,
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId: assignedBy,
        action: "update", // Use 'update' for role assignments
        resource: "user_roles",
        resourceId: userId,
        description: "Roles assigned",
        metadata: { roleIds } as any,
        ipAddress,
        userAgent: null,
      });

      log.info("Roles assigned event logged", { userId, roleIds, assignedBy });
    } catch (error) {
      log.error("Failed to log role assignment", { error });
    }
  }

  /**
   * Log role removal
   */
  async roleRemoved(
    userId: string,
    roleId: string,
    removedBy: string,
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId: removedBy,
        action: "delete", // Use 'delete' for role removal
        resource: "user_roles",
        resourceId: userId,
        description: "Role removed",
        metadata: { roleId } as any,
        ipAddress,
        userAgent: null,
      });

      log.info("Role removed event logged", { userId, roleId, removedBy });
    } catch (error) {
      log.error("Failed to log role removal", { error });
    }
  }

  /**
   * Log visitor creation
   */
  async visitorCreated(
    visitorId: string,
    createdBy: string,
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId: createdBy,
        action: "create",
        resource: "visitor",
        resourceId: visitorId,
        description: "Visitor created",
        metadata: { visitorId } as any,
        ipAddress,
        userAgent: null,
      });

      log.info("Visitor created event logged", { visitorId, createdBy });
    } catch (error) {
      log.error("Failed to log visitor creation", { error });
    }
  }

  /**
   * Log visitor update
   */
  async visitorUpdated(
    visitorId: string,
    updatedBy: string,
    changedFields: string[],
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId: updatedBy,
        action: "update",
        resource: "visitor",
        resourceId: visitorId,
        description: "Visitor updated",
        metadata: { changedFields } as any,
        ipAddress,
        userAgent: null,
      });

      log.info("Visitor updated event logged", {
        visitorId,
        updatedBy,
        changedFields,
      });
    } catch (error) {
      log.error("Failed to log visitor update", { error });
    }
  }

  /**
   * Log visitor deletion (soft delete/blacklist)
   */
  async visitorDeleted(
    visitorId: string,
    deletedBy: string,
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId: deletedBy,
        action: "delete",
        resource: "visitor",
        resourceId: visitorId,
        description: "Visitor deleted (blacklisted)",
        metadata: {} as any,
        ipAddress,
        userAgent: null,
      });

      log.info("Visitor deleted event logged", { visitorId, deletedBy });
    } catch (error) {
      log.error("Failed to log visitor deletion", { error });
    }
  }

  /**
   * Log visitor blacklist
   */
  async visitorBlacklisted(
    visitorId: string,
    reason: string,
    blacklistedBy: string,
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId: blacklistedBy,
        action: "update",
        resource: "visitor",
        resourceId: visitorId,
        description: "Visitor blacklisted",
        metadata: { reason } as any,
        ipAddress,
        userAgent: null,
        severity: "warning",
      });

      log.warn("Visitor blacklisted event logged", {
        visitorId,
        reason,
        blacklistedBy,
      });
    } catch (error) {
      log.error("Failed to log visitor blacklist", { error });
    }
  }

  /**
   * Log visitor removed from blacklist
   */
  async visitorRemovedFromBlacklist(
    visitorId: string,
    removedBy: string,
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId: removedBy,
        action: "update",
        resource: "visitor",
        resourceId: visitorId,
        description: "Visitor removed from blacklist",
        metadata: {} as any,
        ipAddress,
        userAgent: null,
      });

      log.info("Visitor removed from blacklist event logged", {
        visitorId,
        removedBy,
      });
    } catch (error) {
      log.error("Failed to log visitor blacklist removal", { error });
    }
  }

  /**
   * Log user login
   */
  async userLogin(
    userId: string,
    email: string,
    ipAddress: string,
    organizationId: string = "system",
    userAgent?: string
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId,
        action: "login",
        resource: "authentication",
        resourceId: userId,
        description: "User login",
        metadata: { email } as any,
        ipAddress,
        userAgent: userAgent || null,
      });

      log.info("User login event logged", { userId, email });
    } catch (error) {
      log.error("Failed to log user login", { error });
    }
  }

  /**
   * Log user logout
   */
  async userLogout(
    userId: string,
    email: string,
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId,
        action: "logout",
        resource: "authentication",
        resourceId: userId,
        description: "User logout",
        metadata: { email } as any,
        ipAddress,
        userAgent: null,
      });

      log.info("User logout event logged", { userId, email });
    } catch (error) {
      log.error("Failed to log user logout", { error });
    }
  }

  /**
   * Log failed login attempt
   */
  async loginFailed(
    email: string,
    reason: string,
    ipAddress: string,
    organizationId: string = "system"
  ) {
    try {
      await db.insert(auditLogs).values({
        organizationId,
        userId: null,
        action: "login", // Use 'login' for failed attempts
        resource: "authentication",
        resourceId: null,
        description: `Login failed: ${reason}`,
        metadata: { email, reason, success: false } as any,
        success: false,
        ipAddress,
        userAgent: null,
      });

      log.warn("Failed login attempt logged", { email, reason, ipAddress });
    } catch (error) {
      log.error("Failed to log login failure", { error });
    }
  }
}

// Export singleton instance
export const auditLog = new AuditLog();
