import winston from "winston";
import { config } from "../config";

// Create Winston logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "vms-backend" },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// If we're not in production, log to the console with a simple format
if (config.server.nodeEnv !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// Create specialized logging functions
export const log = {
  error: (message: string, meta?: any) => {
    logger.error(message, meta);
  },
  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
  },
  info: (message: string, meta?: any) => {
    logger.info(message, meta);
  },
  debug: (message: string, meta?: any) => {
    logger.debug(message, meta);
  },
  verbose: (message: string, meta?: any) => {
    logger.verbose(message, meta);
  },
};

// Audit logging for security events
export const auditLog = {
  userLogin: (userId: string, email: string, ip: string, userAgent: string) => {
    logger.info("User login", {
      type: "audit",
      action: "login",
      userId,
      email,
      ip,
      userAgent,
    });
  },
  userLogout: (userId: string, email: string, ip: string) => {
    logger.info("User logout", {
      type: "audit",
      action: "logout",
      userId,
      email,
      ip,
    });
  },
  visitCheckin: (
    visitId: string,
    visitorId: string,
    userId: string,
    ip: string
  ) => {
    logger.info("Visitor check-in", {
      type: "audit",
      action: "checkin",
      visitId,
      visitorId,
      userId,
      ip,
    });
  },
  visitCheckout: (
    visitId: string,
    visitorId: string,
    userId: string,
    ip: string
  ) => {
    logger.info("Visitor check-out", {
      type: "audit",
      action: "checkout",
      visitId,
      visitorId,
      userId,
      ip,
    });
  },
  dataAccess: (
    userId: string,
    resource: string,
    action: string,
    resourceId?: string
  ) => {
    logger.info("Data access", {
      type: "audit",
      action: "data_access",
      userId,
      resource,
      operation: action,
      resourceId,
    });
  },
  securityEvent: (event: string, details: any, ip?: string) => {
    logger.warn("Security event", {
      type: "security",
      event,
      details,
      ip,
    });
  },
};

export default logger;
