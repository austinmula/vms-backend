import winston from "winston";
import { config } from "../config";

const isProduction = config.server.nodeEnv === "production";

const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: { service: "vms-backend" },
  transports: [
    new winston.transports.Console({
      format: isProduction
        ? winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: "HH:mm:ss" }),
            winston.format.errors({ stack: true }),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
              const metaStr =
                Object.keys(meta).length > 0
                  ? ` ${JSON.stringify(meta)}`
                  : "";
              return `${timestamp} ${level}: ${message}${metaStr}`;
            })
          ),
    }),
  ],
});

export const log = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  verbose: (message: string, meta?: any) => logger.verbose(message, meta),
};

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
