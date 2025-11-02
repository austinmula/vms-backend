import { Request, Response } from "express";
import { db } from "../db";
import {
  systemUsers,
  employees,
  userRoles,
  roles,
  authenticationTokens,
  rolePermissions,
  permissions,
} from "../db/schema/tables";
import { AuthUtils } from "../utils";
import { auditLog } from "../utils/logger";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

// Request validation schemas
export const registerSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  email: z.string().email("Valid email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain uppercase, lowercase, number and special character"
    ),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain uppercase, lowercase, number and special character"
    ),
});

export class AuthController {
  /**
   * Register a new system user
   */
  static async register(req: Request, res: Response): Promise<Response | void> {
    try {
      const validation = registerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { employeeId, email, password, firstName, lastName, phone } =
        validation.data;
      const clientIp = req.ip || req.connection.remoteAddress || "unknown";

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(systemUsers)
        .where(eq(systemUsers.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        auditLog.securityEvent(
          "registration_attempt_existing_email",
          { email },
          clientIp
        );
        return res.status(409).json({
          success: false,
          message: "User with this email already exists",
        });
      }

      // Verify employee exists
      const employee = await db
        .select()
        .from(employees)
        .where(eq(employees.employeeId, employeeId))
        .limit(1);

      if (employee.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      // Hash password
      const passwordHash = await AuthUtils.hashPassword(password);
      const saltHash = await AuthUtils.generateSalt();

      // Create system user
      const newUser = await db
        .insert(systemUsers)
        .values({
          employeeId: employee[0]!.id,
          email,
          passwordHash,
          saltHash,
          isActive: true,
          mfaEnabled: false,
          mustChangePassword: false,
        })
        .returning();

      // Generate tokens
      const user = newUser[0]!;

      // Get user roles and permissions
      const userRolesResult = await db
        .select({
          roleId: userRoles.roleId,
          roleName: roles.name,
        })
        .from(userRoles)
        .leftJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, user.id));

      const roleIds = userRolesResult.map((r) => r.roleId);
      let userPermissions: string[] = [];

      if (roleIds.length > 0) {
        const permissionsResult = await db
          .select({
            slug: permissions.slug,
          })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(inArray(rolePermissions.roleId, roleIds));

        userPermissions = Array.from(
          new Set(permissionsResult.map((p) => p.slug))
        );
      }

      const accessToken = AuthUtils.generateAccessToken({
        userId: user.id,
        email: user.email,
        employeeId: user.employeeId,
      });

      const refreshToken = AuthUtils.generateRefreshToken({
        userId: user.id,
        email: user.email,
      });

      // Store refresh token
      await db.insert(authenticationTokens).values({
        userId: user.id,
        tokenType: "refresh",
        tokenHash: await AuthUtils.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        isActive: true,
      });

      // Log successful registration
      auditLog.userLogin(
        user.id,
        email,
        clientIp,
        req.get("User-Agent") || "unknown"
      );

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user.id,
            email: user.email,
            employeeId: user.employeeId,
            permissions: userPermissions,
            isActive: user.isActive,
            mfaEnabled: user.mfaEnabled,
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: "24h",
          },
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response): Promise<Response | void> {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { email, password } = validation.data;
      const clientIp = req.ip || req.connection.remoteAddress || "unknown";
      const userAgent = req.get("User-Agent") || "unknown";

      // Find user with employee data
      const userResult = await db
        .select({
          user: systemUsers,
          employee: employees,
          roles: {
            id: roles.id,
            name: roles.name,
            displayName: roles.name,
          },
        })
        .from(systemUsers)
        .leftJoin(employees, eq(systemUsers.employeeId, employees.id))
        .leftJoin(userRoles, eq(systemUsers.id, userRoles.userId))
        .leftJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(systemUsers.email, email));

      if (userResult.length === 0) {
        auditLog.securityEvent(
          "login_attempt_invalid_email",
          { email },
          clientIp
        );
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      const user = userResult[0]!.user!;
      const employee = userResult[0]!.employee;

      // Check if user is active
      if (!user.isActive) {
        auditLog.securityEvent(
          "login_attempt_inactive_user",
          { userId: user.id, email },
          clientIp
        );
        return res.status(401).json({
          success: false,
          message: "Account is inactive",
        });
      }

      // Check if user is locked
      if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) {
        auditLog.securityEvent(
          "login_attempt_locked_user",
          { userId: user.id, email },
          clientIp
        );
        return res.status(401).json({
          success: false,
          message: "Account is temporarily locked",
        });
      }

      // Verify password
      const isPasswordValid = await AuthUtils.comparePassword(
        password,
        user.passwordHash
      );
      if (!isPasswordValid) {
        // Increment failed login attempts
        const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
        const shouldLock = newFailedAttempts >= 5;

        await db
          .update(systemUsers)
          .set({
            failedLoginAttempts: newFailedAttempts,
            lastFailedLoginAt: new Date(),
            ...(shouldLock && {
              isLocked: true,
              lockedAt: new Date(),
              lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
              lockReason: "Too many failed login attempts",
            }),
          })
          .where(eq(systemUsers.id, user.id));

        auditLog.securityEvent(
          "login_attempt_invalid_password",
          {
            userId: user.id,
            email,
            failedAttempts: newFailedAttempts,
            locked: shouldLock,
          },
          clientIp
        );

        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Reset failed login attempts on successful login
      await db
        .update(systemUsers)
        .set({
          failedLoginAttempts: 0,
          lastFailedLoginAt: null,
          lastSuccessfulLoginAt: new Date(),
          lastActivityAt: new Date(),
          isLocked: false,
          lockedAt: null,
          lockedUntil: null,
          lockReason: null,
        })
        .where(eq(systemUsers.id, user.id));

      // Get user roles
      const userRolesList = userResult
        .filter((r) => r.roles?.id)
        .map((r) => ({
          id: r.roles!.id,
          name: r.roles!.name,
          displayName: r.roles!.name,
        }));

      // Get user permissions
      const roleIds = userRolesList.map((r) => r.id);
      let userPermissions: string[] = [];

      if (roleIds.length > 0) {
        const permissionsResult = await db
          .select({
            slug: permissions.slug,
          })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(inArray(rolePermissions.roleId, roleIds));

        // Remove duplicates using Set
        userPermissions = Array.from(
          new Set(permissionsResult.map((p) => p.slug))
        );
      }

      // Generate tokens
      const accessToken = AuthUtils.generateAccessToken({
        userId: user.id,
        email: user.email,
        employeeId: user.employeeId,
        roles: userRolesList.map((r) => r.name),
      });

      const refreshToken = AuthUtils.generateRefreshToken({
        userId: user.id,
        email: user.email,
      });

      // Store refresh token
      await db.insert(authenticationTokens).values({
        userId: user.id,
        tokenType: "refresh",
        tokenHash: await AuthUtils.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        isActive: true,
        metadata: {
          userAgent,
          ipAddress: clientIp,
        },
      });

      // Log successful login
      auditLog.userLogin(user.id, email, clientIp, userAgent);

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user.id,
            email: user.email,
            employeeId: user.employeeId,
            employee: employee
              ? {
                  firstName: employee.firstName,
                  lastName: employee.lastName,
                  department: employee.department,
                  jobTitle: employee.jobTitle,
                }
              : null,
            roles: userRolesList,
            permissions: userPermissions,
            isActive: user.isActive,
            mfaEnabled: user.mfaEnabled,
            mustChangePassword: user.mustChangePassword,
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: "24h",
          },
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Refresh access token
   */
  static async refresh(req: Request, res: Response): Promise<Response | void> {
    try {
      const validation = refreshTokenSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { refreshToken } = validation.data;
      const clientIp = req.ip || req.connection.remoteAddress || "unknown";

      // Verify refresh token
      const decoded = AuthUtils.verifyRefreshToken(refreshToken);
      if (!decoded) {
        auditLog.securityEvent("refresh_token_invalid", {}, clientIp);
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
        });
      }

      const tokenHash = await AuthUtils.hashToken(refreshToken);

      // Find active token
      const tokenRecord = await db
        .select()
        .from(authenticationTokens)
        .where(
          and(
            eq(authenticationTokens.userId, decoded.userId),
            eq(authenticationTokens.tokenHash, tokenHash),
            eq(authenticationTokens.tokenType, "refresh"),
            eq(authenticationTokens.isActive, true)
          )
        )
        .limit(1);

      if (
        tokenRecord.length === 0 ||
        (tokenRecord[0] && tokenRecord[0].expiresAt < new Date())
      ) {
        auditLog.securityEvent(
          "refresh_token_not_found_or_expired",
          { userId: decoded.userId },
          clientIp
        );
        return res.status(401).json({
          success: false,
          message: "Refresh token expired or not found",
        });
      }

      // Get user with roles
      const userResult = await db
        .select({
          user: systemUsers,
          roles: {
            id: roles.id,
            name: roles.name,
            displayName: roles.name,
          },
        })
        .from(systemUsers)
        .leftJoin(userRoles, eq(systemUsers.id, userRoles.userId))
        .leftJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(systemUsers.id, decoded.userId));

      if (userResult.length === 0 || !userResult[0]!.user!.isActive) {
        return res.status(401).json({
          success: false,
          message: "User not found or inactive",
        });
      }

      const user = userResult[0]!.user!;
      const userRolesList = userResult
        .filter((r) => r.roles?.id)
        .map((r) => r.roles!.name);

      // Generate new access token
      const accessToken = AuthUtils.generateAccessToken({
        userId: user.id,
        email: user.email,
        employeeId: user.employeeId,
        roles: userRolesList,
      });

      // Update last activity
      await db
        .update(systemUsers)
        .set({ lastActivityAt: new Date() })
        .where(eq(systemUsers.id, user.id));

      res.json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          tokens: {
            accessToken,
            expiresIn: "24h",
          },
        },
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Logout user
   */
  static async logout(req: Request, res: Response) {
    try {
      const refreshToken = req.body.refreshToken;
      const userId = req.user?.userId;
      const clientIp = req.ip || req.connection.remoteAddress || "unknown";

      if (refreshToken) {
        // Invalidate specific refresh token
        const tokenHash = await AuthUtils.hashToken(refreshToken);
        await db
          .update(authenticationTokens)
          .set({
            isActive: false,
            revokedAt: new Date(),
          })
          .where(
            and(
              eq(authenticationTokens.tokenHash, tokenHash),
              eq(authenticationTokens.tokenType, "refresh")
            )
          );
      }

      if (userId) {
        // Update last activity
        await db
          .update(systemUsers)
          .set({ lastActivityAt: new Date() })
          .where(eq(systemUsers.id, userId));

        auditLog.userLogout(userId, req.user?.email || "unknown", clientIp);
      }

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get current user profile
   */
  static async me(req: Request, res: Response): Promise<Response | void> {
    try {
      const userId = req.user!.userId;

      const userResult = await db
        .select({
          user: systemUsers,
          employee: employees,
          roles: {
            id: roles.id,
            name: roles.name,
            displayName: roles.name,
          },
        })
        .from(systemUsers)
        .leftJoin(employees, eq(systemUsers.employeeId, employees.id))
        .leftJoin(userRoles, eq(systemUsers.id, userRoles.userId))
        .leftJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(systemUsers.id, userId));

      if (userResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const user = userResult[0]!.user!;
      const employee = userResult[0]!.employee;
      const userRolesList = userResult
        .filter((r) => r.roles?.id)
        .map((r) => ({
          id: r.roles!.id,
          name: r.roles!.name,
          displayName: r.roles!.name,
        }));

      // Get user permissions
      const roleIds = userRolesList.map((r) => r.id);
      let userPermissions: string[] = [];

      if (roleIds.length > 0) {
        const permissionsResult = await db
          .select({
            slug: permissions.slug,
          })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(inArray(rolePermissions.roleId, roleIds));

        // Remove duplicates using Set
        userPermissions = Array.from(
          new Set(permissionsResult.map((p) => p.slug))
        );
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            employeeId: user.employeeId,
            employee: employee
              ? {
                  firstName: employee.firstName,
                  lastName: employee.lastName,
                  department: employee.department,
                  jobTitle: employee.jobTitle,
                  phone: employee.phone,
                }
              : null,
            roles: userRolesList,
            permissions: userPermissions,
            isActive: user.isActive,
            mfaEnabled: user.mfaEnabled,
            mustChangePassword: user.mustChangePassword,
            lastSuccessfulLoginAt: user.lastSuccessfulLoginAt,
            createdAt: user.createdAt,
          },
        },
      });
    } catch (error) {
      console.error("Get profile error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Forgot password - send reset email
   */
  static async forgotPassword(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const validation = forgotPasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { email } = validation.data;
      const clientIp = req.ip || req.connection.remoteAddress || "unknown";

      // Find user
      const user = await db
        .select()
        .from(systemUsers)
        .where(eq(systemUsers.email, email))
        .limit(1);

      // Always return success to prevent email enumeration
      if (user.length === 0) {
        auditLog.securityEvent(
          "password_reset_request_invalid_email",
          { email },
          clientIp
        );
        return res.json({
          success: true,
          message: "If the email exists, a password reset link has been sent",
        });
      }

      // Generate reset token
      const resetToken = AuthUtils.generateResetToken();
      const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      await db.insert(authenticationTokens).values({
        userId: user[0]!.id,
        tokenType: "password_reset",
        tokenHash: await AuthUtils.hashToken(resetToken),
        expiresAt: tokenExpiry,
        isActive: true,
        metadata: {
          ipAddress: clientIp,
          requestedAt: new Date(),
        },
      });

      // TODO: Send email with reset link
      // await EmailService.sendPasswordReset(email, resetToken);

      auditLog.securityEvent(
        "password_reset_request",
        { userId: user[0]!.id, email },
        clientIp
      );

      res.json({
        success: true,
        message: "If the email exists, a password reset link has been sent",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Reset password using token
   */
  static async resetPassword(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const validation = resetPasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { token, password } = validation.data;
      const clientIp = req.ip || req.connection.remoteAddress || "unknown";

      const tokenHash = await AuthUtils.hashToken(token);

      // Find valid reset token
      const tokenRecord = await db
        .select()
        .from(authenticationTokens)
        .where(
          and(
            eq(authenticationTokens.tokenHash, tokenHash),
            eq(authenticationTokens.tokenType, "password_reset"),
            eq(authenticationTokens.isActive, true)
          )
        )
        .limit(1);

      if (
        tokenRecord.length === 0 ||
        (tokenRecord[0] && tokenRecord[0].expiresAt < new Date())
      ) {
        auditLog.securityEvent("password_reset_invalid_token", {}, clientIp);
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token",
        });
      }

      const userId = tokenRecord[0]!.userId;

      // Hash new password
      const passwordHash = await AuthUtils.hashPassword(password);
      const saltHash = await AuthUtils.generateSalt();

      // Update password
      await db
        .update(systemUsers)
        .set({
          passwordHash,
          saltHash,
          lastPasswordChangeAt: new Date(),
          mustChangePassword: false,
          failedLoginAttempts: 0,
          isLocked: false,
          lockedAt: null,
          lockedUntil: null,
          lockReason: null,
        })
        .where(eq(systemUsers.id, userId));

      // Invalidate reset token
      await db
        .update(authenticationTokens)
        .set({
          isActive: false,
          revokedAt: new Date(),
        })
        .where(eq(authenticationTokens.id, tokenRecord[0]!.id));

      // Invalidate all refresh tokens for this user (force re-login)
      await db
        .update(authenticationTokens)
        .set({
          isActive: false,
          revokedAt: new Date(),
        })
        .where(
          and(
            eq(authenticationTokens.userId, userId),
            eq(authenticationTokens.tokenType, "refresh"),
            eq(authenticationTokens.isActive, true)
          )
        );

      auditLog.securityEvent("password_reset_success", { userId }, clientIp);

      res.json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}
