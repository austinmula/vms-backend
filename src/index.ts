import App from "./app";
import { log } from "./utils/logger";

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  log.error("Uncaught Exception", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  log.error("Unhandled Rejection at:", { promise, reason });
  process.exit(1);
});

// Handle SIGTERM gracefully
process.on("SIGTERM", () => {
  log.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

// Handle SIGINT gracefully
process.on("SIGINT", () => {
  log.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Start the application
async function bootstrap() {
  try {
    const app = new App();
    await app.start();
  } catch (error) {
    log.error("Failed to bootstrap application", error);
    process.exit(1);
  }
}

bootstrap();
