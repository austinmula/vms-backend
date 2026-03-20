import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { log } from "../utils/logger";

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

export const errorHandler = (
  error: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = "Internal Server Error";
  let errors: string[] = [];

  // Handle different error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = "Validation Error";
    errors = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`);
  } else if ((error as any).code === "23505") {
    // PostgreSQL unique_violation
    statusCode = 409;
    message = "A record with this value already exists";
  } else if ((error as any).code === "23503") {
    // PostgreSQL foreign_key_violation
    statusCode = 409;
    message = "Related resource not found";
  } else if ((error as any).code === "23502") {
    // PostgreSQL not_null_violation
    statusCode = 400;
    message = "Missing required field";
  } else if (error.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  } else if (error.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  // Log error
  if (statusCode >= 500) {
    log.error("Server Error", {
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: (req as any).user?.userId,
    });
  } else {
    log.warn("Client Error", {
      error: error.message,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      statusCode,
    });
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors.length > 0 && { errors }),
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
};

// Async error handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation middleware
export const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body, query, params } = req;

      // Validate different parts of the request
      if (schema.body) {
        req.body = schema.body.parse(body);
      }
      if (schema.query) {
        req.query = schema.query.parse(query);
      }
      if (schema.params) {
        req.params = schema.params.parse(params);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
