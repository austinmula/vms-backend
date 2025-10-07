import { Request, Response, NextFunction } from "express";
import { AuthUtils } from "../utils";
import { log } from "../utils/logger";
import { JwtPayload } from "../types";

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
      });
    }

    const decoded = AuthUtils.verifyToken(token);
    req.user = decoded;

    log.debug("User authenticated", {
      userId: decoded.userId,
      email: decoded.email,
    });
    return next();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.warn("Authentication failed", { error: errorMessage });

    if (error instanceof Error && error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Access token has expired",
      });
    }

    if (error instanceof Error && error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid access token",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      log.warn("Unauthorized access attempt", {
        userId: req.user.userId,
        role: req.user.role,
        requiredRoles: roles,
      });

      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    return next();
  };
};

export const requireCompanyAccess = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Super admin can access any company
  if (req.user.role === "super_admin") {
    return next();
  }

  // Check if user is trying to access their own company's data
  const companyId =
    req.params.companyId || req.body.companyId || req.query.companyId;

  if (companyId && companyId !== req.user.companyId) {
    log.warn("Unauthorized company access attempt", {
      userId: req.user.userId,
      userCompanyId: req.user.companyId,
      targetCompanyId: companyId,
    });

    return res.status(403).json({
      success: false,
      message: "Access denied to company data",
    });
  }

  return next();
};

export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  try {
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;

    if (token) {
      const decoded = AuthUtils.verifyToken(token);
      req.user = decoded;
    }
  } catch (error) {
    // Ignore auth errors for optional auth
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.debug("Optional auth failed", { error: errorMessage });
  }

  return next();
};

// Export alias for backward compatibility
export const authenticateToken = authMiddleware;
