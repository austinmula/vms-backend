import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config, validateConfig } from "./config";
import { testConnection } from "./db";
import { log } from "./utils/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authMiddleware } from "./middleware/auth";

// Import routes
import authRoutes from "./routes/auth";
import { usersRouter } from "./routes/users";
import { visitorsRouter } from "./routes/visitors";
import { organizationsRouter } from "./routes/organizations";
import { rolesRouter } from "./routes/roles";
import { permissionsRouter } from "./routes/permissions";
// import visitRoutes from "./routes/visits";
// import companyRoutes from "./routes/companies";
// import locationRoutes from "./routes/locations";
// import areaRoutes from "./routes/areas";
// import dashboardRoutes from "./routes/dashboard";

class App {
  public app: express.Application;

  constructor() {
    this.app = express();
    this.validateEnvironment();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private validateEnvironment() {
    try {
      validateConfig();
      log.info("Environment configuration validated");
    } catch (error) {
      log.error("Environment validation failed", error);
      process.exit(1);
    }
  }

  private initializeMiddlewares() {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: config.cors.origin,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      })
    );

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxAttempts,
      message: {
        success: false,
        message: "Too many requests from this IP, please try again later.",
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Logging middleware
    if (config.server.nodeEnv === "development") {
      this.app.use(morgan("dev"));
    } else {
      this.app.use(morgan("combined"));
    }

    // Trust proxy for proper IP detection
    this.app.set("trust proxy", 1);
  }

  private initializeRoutes() {
    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.status(200).json({
        success: true,
        message: "VMS Backend API is running",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      });
    });

    // API routes
    this.app.use("/api/auth", authRoutes);
    this.app.use("/api/users", usersRouter);
    this.app.use("/api/visitors", visitorsRouter);
    this.app.use("/api/organizations", organizationsRouter);
    this.app.use("/api/roles", rolesRouter);
    this.app.use("/api/permissions", permissionsRouter);
    // this.app.use("/api/visits", authMiddleware, visitRoutes);
    // this.app.use("/api/companies", authMiddleware, companyRoutes);
    // this.app.use("/api/locations", authMiddleware, locationRoutes);
    // this.app.use("/api/areas", authMiddleware, areaRoutes);
    // this.app.use("/api/dashboard", authMiddleware, dashboardRoutes);

    // API documentation
    this.app.get("/api", (req, res) => {
      res.json({
        success: true,
        message: "Visitor Management System API",
        version: "1.0.0",
        documentation: {
          auth: "/api/auth",
          users: "/api/users",
          visitors: "/api/visitors",
          organizations: "/api/organizations",
          visits: "/api/visits",
          companies: "/api/companies",
          locations: "/api/locations",
          areas: "/api/areas",
          dashboard: "/api/dashboard",
        },
        endpoints: {
          health: "GET /health",
          auth: {
            login: "POST /api/auth/login",
            register: "POST /api/auth/register",
            refresh: "POST /api/auth/refresh",
            logout: "POST /api/auth/logout",
          },
          visits: {
            list: "GET /api/visits",
            create: "POST /api/visits",
            get: "GET /api/visits/:id",
            update: "PUT /api/visits/:id",
            updateStatus: "PATCH /api/visits/:id/status",
            checkin: "POST /api/visits/:id/checkin",
            checkout: "POST /api/visits/:id/checkout",
          },
          visitors: {
            list: "GET /api/visitors",
            create: "POST /api/visitors",
            get: "GET /api/visitors/:id",
            update: "PUT /api/visitors/:id",
            delete: "DELETE /api/visitors/:id",
          },
        },
      });
    });
  }

  private initializeErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public async start() {
    try {
      // Test database connection
      await testConnection();
      log.info("Database connection established");

      // Start server
      const port = config.server.port;
      this.app.listen(port, () => {
        log.info(`🚀 VMS Backend API server running on port ${port}`);
        log.info(
          `📚 API Documentation available at http://localhost:${port}/api`
        );
        log.info(
          `🏥 Health check available at http://localhost:${port}/health`
        );
        log.info(`🌍 Environment: ${config.server.nodeEnv}`);
      });
    } catch (error) {
      log.error("Failed to start server", error);
      process.exit(1);
    }
  }
}

export default App;
