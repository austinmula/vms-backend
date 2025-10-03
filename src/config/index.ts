import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || "3000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
  },

  // Database configuration
  database: {
    url: process.env.DATABASE_URL || "",
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || "fallback-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes
    maxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || "100", 10),
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};

// Validate required environment variables
export function validateConfig() {
  const required = ["DATABASE_URL", "JWT_SECRET"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

// Export individual configurations for convenience
export const { server, database, jwt, rateLimit, cors, logging } = config;
