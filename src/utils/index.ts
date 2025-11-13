import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config";
import { JwtPayload } from "../types";

export class AuthUtils {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare a password with its hash
   */
  static async comparePassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a salt for password hashing
   */
  static async generateSalt(): Promise<string> {
    return bcrypt.genSalt(12);
  }

  /**
   * Generate an access JWT token
   */
  static generateAccessToken(payload: {
    userId: string;
    email: string;
    employeeId: string;
    organizationId: string;
    roles?: string[];
  }): string {
    try {
      if (!config.jwt.secret) {
        throw new Error("JWT secret is not configured");
      }

      const tokenPayload = {
        userId: payload.userId,
        email: payload.email,
        employeeId: payload.employeeId,
        organizationId: payload.organizationId,
        roles: payload.roles || [],
        type: "access",
      };

      return jwt.sign(tokenPayload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      } as SignOptions);
    } catch (error) {
      throw new Error(
        "Failed to generate access token: " + (error as Error).message
      );
    }
  }

  /**
   * Generate a refresh JWT token
   */
  static generateRefreshToken(payload: {
    userId: string;
    email: string;
  }): string {
    try {
      if (!config.jwt.secret) {
        throw new Error("JWT secret is not configured");
      }

      const tokenPayload = {
        userId: payload.userId,
        email: payload.email,
        type: "refresh",
      };

      return jwt.sign(tokenPayload, config.jwt.secret, {
        expiresIn: config.jwt.refreshExpiresIn,
      } as SignOptions);
    } catch (error) {
      throw new Error(
        "Failed to generate refresh token: " + (error as Error).message
      );
    }
  }

  /**
   * Generate a JWT token (legacy method)
   */
  static generateToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
    try {
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid payload for JWT token generation");
      }

      if (!config.jwt.secret) {
        throw new Error("JWT secret is not configured");
      }

      // Convert payload to a plain object to avoid issues with Omit type
      const tokenPayload = {
        userId: payload.userId,
        companyId: payload.companyId,
        email: payload.email,
        role: payload.role,
      };

      return jwt.sign(tokenPayload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      } as SignOptions);
    } catch (error) {
      throw new Error(
        `Failed to generate JWT token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Hash a token for storage
   */
  static async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  /**
   * Generate a password reset token
   */
  static generateResetToken(): string {
    return jwt.sign({ type: "password_reset" }, config.jwt.secret, {
      expiresIn: "1h",
    } as SignOptions);
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch {
      return null;
    }
  }

  /**
   * Verify a JWT token
   */
  static verifyToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  }

  /**
   * Decode a JWT token without verification (for debugging)
   */
  static decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }
}

/**
 * Generate a random badge number
 */
export function generateBadgeNumber(): string {
  const prefix = "VIS";
  const number = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${number}`;
}

/**
 * Generate a random parking spot
 */
export function generateParkingSpot(): string {
  const levels = ["B1", "B2", "L1", "L2", "L3"];
  const spots = Array.from({ length: 50 }, (_, i) =>
    String(i + 1).padStart(2, "0")
  );
  const level = levels[Math.floor(Math.random() * levels.length)];
  const spot = spots[Math.floor(Math.random() * spots.length)];
  return `${level}-${spot}`;
}

/**
 * Check if a user has permission to perform an action
 */
export function hasPermission(
  userRole: string,
  requiredRoles: string[]
): boolean {
  if (userRole === "super_admin") return true;
  return requiredRoles.includes(userRole);
}

/**
 * Check if a user can access company data
 */
export function canAccessCompany(
  userCompanyId: string,
  targetCompanyId: string,
  userRole: string
): boolean {
  if (userRole === "super_admin") return true;
  return userCompanyId === targetCompanyId;
}

/**
 * Format user name
 */
export function formatUserName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Extract IP address from request
 */
export function getClientIP(req: any): string {
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.headers?.["x-forwarded-for"]?.split(",")[0] ||
    "unknown"
  );
}

/**
 * Generate a secure random string
 */
export function generateSecureString(length: number = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ""));
}

/**
 * Sanitize file name
 */
export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age--;
  }

  return age;
}

/**
 * Format duration in human readable format
 */
export function formatDuration(startTime: Date, endTime: Date): string {
  const diff = endTime.getTime() - startTime.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
