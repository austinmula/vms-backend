import { Request, Response } from "express";
import { and, eq, ilike, or, desc } from "drizzle-orm";
import { db } from "../db";
import { visitors, visits, watchlist } from "../db/schema/tables";
import {
  createVisitorSchema,
  updateVisitorSchema,
  listVisitorsQuerySchema,
} from "../types/schemas";
import { log } from "../utils/logger";
import { auditLog } from "../utils/auditLog";

/**
 * Helper function to fetch visitor with additional details
 */
async function fetchVisitorWithDetails(visitorId: string) {
  const visitor = await db
    .select()
    .from(visitors)
    .where(eq(visitors.id, visitorId))
    .limit(1);

  if (visitor.length === 0) return null;

  return visitor[0];
}

/**
 * VisitorsController
 * Handles all visitor-related operations with multi-tenant support
 */
export class VisitorsController {
  /**
   * List all visitors with pagination, filtering, and search
   * GET /api/visitors
   */
  static async list(req: Request, res: Response) {
    try {
      const parsed = listVisitorsQuerySchema.parse(req.query);
      const { search, isBlacklisted, company, limit = 25, offset = 0 } = parsed;

      // Build where conditions
      const conditions = [];

      // Filter by blacklist status if provided
      if (typeof isBlacklisted === "boolean") {
        conditions.push(eq(visitors.isBlacklisted, isBlacklisted));
      }

      // Filter by company if provided
      if (company) {
        conditions.push(ilike(visitors.company, `%${company}%`));
      }

      // Build base query
      let baseQuery = db
        .select()
        .from(visitors)
        .orderBy(desc(visitors.createdAt));

      // Apply conditions if any
      if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as any;
      }

      // Execute query with pagination
      let visitorsList = await baseQuery.limit(limit).offset(offset);

      // Apply search filter (searches across multiple fields)
      if (search) {
        const searchLower = search.toLowerCase();
        visitorsList = visitorsList.filter(
          (v) =>
            v.firstName.toLowerCase().includes(searchLower) ||
            v.lastName.toLowerCase().includes(searchLower) ||
            (v.email || "").toLowerCase().includes(searchLower) ||
            (v.phone || "").toLowerCase().includes(searchLower) ||
            (v.company || "").toLowerCase().includes(searchLower)
        );
      }

      // Get total count for pagination metadata
      const totalQuery = db
        .select({ id: visitors.id })
        .from(visitors);

      const totalResult = await (conditions.length > 0
        ? totalQuery.where(and(...conditions))
        : totalQuery);
      const total = totalResult.length;

      return res.json({
        success: true,
        data: visitorsList,
        pagination: {
          total,
          count: visitorsList.length,
          limit,
          offset,
          hasMore: offset + visitorsList.length < total,
        },
      });
    } catch (error) {
      log.error("List visitors failed", { error });
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * Create a new visitor
   * POST /api/visitors
   */
  static async create(req: Request, res: Response) {
    try {
      const body = createVisitorSchema.parse(req.body);
      const {
        email,
        firstName,
        lastName,
        phone,
        company,
        idType,
        idNumber,
        emergencyContact,
        emergencyPhone,
        notes,
      } = body;

      // Check if email already exists (if provided)
      if (email) {
        const existing = await db
          .select({ id: visitors.id })
          .from(visitors)
          .where(eq(visitors.email, email))
          .limit(1);

        if (existing.length > 0) {
          return res.status(409).json({
            success: false,
            message: "A visitor with this email already exists",
          });
        }
      }

      // Check if visitor is on watchlist
      const watchlistCheck = await db
        .select()
        .from(watchlist)
        .where(
          or(
            email ? eq(watchlist.email, email) : undefined,
            eq(watchlist.phone, phone)
          )
        )
        .limit(1);

      if (watchlistCheck.length > 0) {
        log.warn("Attempted to create visitor on watchlist", {
          firstName,
          lastName,
          email,
          phone,
          watchlistReason: watchlistCheck[0].reason,
        });

        return res.status(403).json({
          success: false,
          message: "This visitor is on the watchlist and cannot be created",
          reason: watchlistCheck[0].reason,
        });
      }

      // Insert visitor
      const inserted = await db
        .insert(visitors)
        .values({
          email: email || null,
          firstName,
          lastName,
          phone,
          company: company || null,
          emergencyContact: emergencyContact || null,
          emergencyPhone: emergencyPhone || null,
          notes: notes || null,
          isBlacklisted: false,
          visitCount: 0,
          riskScore: 0,
        })
        .returning();

      const visitor = inserted[0];
      if (!visitor) {
        return res.status(500).json({
          success: false,
          message: "Failed to create visitor",
        });
      }

      // Audit log
      await auditLog.visitorCreated(
        visitor.id,
        req.user?.userId || "system",
        req.ip || "unknown"
      );

      log.info("Visitor created", {
        visitorId: visitor.id,
        firstName,
        lastName,
        createdBy: req.user?.userId,
      });

      return res.status(201).json({
        success: true,
        message: "Visitor created successfully",
        data: visitor,
      });
    } catch (error) {
      log.error("Create visitor failed", { error });
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * Get visitor by ID with visit history
   * GET /api/visitors/:id
   */
  static async getById(req: Request, res: Response) {
    try {
      const visitorId = req.params.id;

      const visitor = await fetchVisitorWithDetails(visitorId);

      if (!visitor) {
        return res.status(404).json({
          success: false,
          message: "Visitor not found",
        });
      }

      return res.json({
        success: true,
        data: visitor,
      });
    } catch (error) {
      log.error("Get visitor failed", { error });
      return res.status(500).json({
        success: false,
        message: "Internal error",
      });
    }
  }

  /**
   * Get visitor visit history
   * GET /api/visitors/:id/visits
   */
  static async getVisitHistory(req: Request, res: Response) {
    try {
      const visitorId = req.params.id;

      // Check if visitor exists
      const visitor = await db
        .select({ id: visitors.id })
        .from(visitors)
        .where(eq(visitors.id, visitorId))
        .limit(1);

      if (visitor.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Visitor not found",
        });
      }

      // Get visit history with pagination
      const limit = parseInt(req.query.limit as string) || 25;
      const offset = parseInt(req.query.offset as string) || 0;

      const visitHistory = await db
        .select()
        .from(visits)
        .where(eq(visits.visitorId, visitorId))
        .orderBy(desc(visits.createdAt))
        .limit(limit)
        .offset(offset);

      return res.json({
        success: true,
        data: visitHistory,
        pagination: {
          count: visitHistory.length,
          limit,
          offset,
        },
      });
    } catch (error) {
      log.error("Get visitor history failed", { error });
      return res.status(500).json({
        success: false,
        message: "Internal error",
      });
    }
  }

  /**
   * Update visitor details
   * PUT /api/visitors/:id
   */
  static async update(req: Request, res: Response) {
    try {
      const visitorId = req.params.id;
      const body = updateVisitorSchema.parse(req.body);

      // Check if visitor exists
      const existing = await db
        .select({ id: visitors.id })
        .from(visitors)
        .where(eq(visitors.id, visitorId))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Visitor not found",
        });
      }

      // If email is being updated, check for duplicates
      if (body.email) {
        const emailCheck = await db
          .select({ id: visitors.id })
          .from(visitors)
          .where(
            and(
              eq(visitors.email, body.email),
              // Exclude current visitor from check
              eq(visitors.id, visitorId)
            )
          )
          .limit(1);

        // Only error if we found a different visitor with same email
        const duplicateExists = await db
          .select({ id: visitors.id })
          .from(visitors)
          .where(eq(visitors.email, body.email))
          .limit(2);

        if (duplicateExists.length > 1 || (duplicateExists.length === 1 && duplicateExists[0].id !== visitorId)) {
          return res.status(409).json({
            success: false,
            message: "Email already in use by another visitor",
          });
        }
      }

      // Build update object with only provided fields
      const updateValues: any = {
        updatedAt: new Date(),
      };

      if (body.email !== undefined) updateValues.email = body.email;
      if (body.firstName !== undefined) updateValues.firstName = body.firstName;
      if (body.lastName !== undefined) updateValues.lastName = body.lastName;
      if (body.phone !== undefined) updateValues.phone = body.phone;
      if (body.company !== undefined) updateValues.company = body.company;
      if (body.emergencyContact !== undefined)
        updateValues.emergencyContact = body.emergencyContact;
      if (body.emergencyPhone !== undefined)
        updateValues.emergencyPhone = body.emergencyPhone;
      if (body.notes !== undefined) updateValues.notes = body.notes;

      // Perform update
      await db
        .update(visitors)
        .set(updateValues)
        .where(eq(visitors.id, visitorId));

      // Fetch updated visitor
      const updated = await fetchVisitorWithDetails(visitorId);

      // Audit log
      const changedFields = Object.keys(updateValues).filter(
        (k) => k !== "updatedAt"
      );
      await auditLog.visitorUpdated(
        visitorId,
        req.user?.userId || "system",
        changedFields,
        req.ip || "unknown"
      );

      log.info("Visitor updated", {
        visitorId,
        changedFields,
        updatedBy: req.user?.userId,
      });

      return res.json({
        success: true,
        message: "Visitor updated successfully",
        data: updated,
      });
    } catch (error) {
      log.error("Update visitor failed", { error });
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  /**
   * Soft delete visitor (mark as blacklisted)
   * DELETE /api/visitors/:id
   */
  static async softDelete(req: Request, res: Response) {
    try {
      const visitorId = req.params.id;

      // Check if visitor exists
      const existing = await db
        .select({ id: visitors.id })
        .from(visitors)
        .where(eq(visitors.id, visitorId))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Visitor not found",
        });
      }

      // Mark as blacklisted instead of deleting
      await db
        .update(visitors)
        .set({
          isBlacklisted: true,
          blacklistReason: "Deactivated by administrator",
          blacklistedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(visitors.id, visitorId));

      // Audit log
      await auditLog.visitorDeleted(
        visitorId,
        req.user?.userId || "system",
        req.ip || "unknown"
      );

      log.info("Visitor soft deleted (blacklisted)", {
        visitorId,
        deletedBy: req.user?.userId,
      });

      return res.status(200).json({
        success: true,
        message: "Visitor deactivated successfully",
      });
    } catch (error) {
      log.error("Soft delete visitor failed", { error });
      return res.status(500).json({
        success: false,
        message: "Internal error",
      });
    }
  }

  /**
   * Blacklist a visitor
   * POST /api/visitors/:id/blacklist
   */
  static async blacklist(req: Request, res: Response) {
    try {
      const visitorId = req.params.id;
      const { reason } = req.body;

      if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Blacklist reason is required",
        });
      }

      // Check if visitor exists
      const existing = await db
        .select({ id: visitors.id })
        .from(visitors)
        .where(eq(visitors.id, visitorId))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Visitor not found",
        });
      }

      // Update visitor to blacklisted
      await db
        .update(visitors)
        .set({
          isBlacklisted: true,
          blacklistReason: reason,
          blacklistedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(visitors.id, visitorId));

      // Audit log
      await auditLog.visitorBlacklisted(
        visitorId,
        reason,
        req.user?.userId || "system",
        req.ip || "unknown"
      );

      log.warn("Visitor blacklisted", {
        visitorId,
        reason,
        blacklistedBy: req.user?.userId,
      });

      return res.json({
        success: true,
        message: "Visitor blacklisted successfully",
      });
    } catch (error) {
      log.error("Blacklist visitor failed", { error });
      return res.status(500).json({
        success: false,
        message: "Internal error",
      });
    }
  }

  /**
   * Remove visitor from blacklist
   * DELETE /api/visitors/:id/blacklist
   */
  static async removeFromBlacklist(req: Request, res: Response) {
    try {
      const visitorId = req.params.id;

      // Check if visitor exists
      const existing = await db
        .select({ id: visitors.id, isBlacklisted: visitors.isBlacklisted })
        .from(visitors)
        .where(eq(visitors.id, visitorId))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Visitor not found",
        });
      }

      if (!existing[0].isBlacklisted) {
        return res.status(400).json({
          success: false,
          message: "Visitor is not blacklisted",
        });
      }

      // Remove from blacklist
      await db
        .update(visitors)
        .set({
          isBlacklisted: false,
          blacklistReason: null,
          blacklistedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(visitors.id, visitorId));

      // Audit log
      await auditLog.visitorRemovedFromBlacklist(
        visitorId,
        req.user?.userId || "system",
        req.ip || "unknown"
      );

      log.info("Visitor removed from blacklist", {
        visitorId,
        removedBy: req.user?.userId,
      });

      return res.json({
        success: true,
        message: "Visitor removed from blacklist successfully",
      });
    } catch (error) {
      log.error("Remove from blacklist failed", { error });
      return res.status(500).json({
        success: false,
        message: "Internal error",
      });
    }
  }
}
