import App from "./app";
import { closePool } from "./db";
import { log } from "./utils/logger";

process.on("uncaughtException", (error: Error) => {
  log.error("Uncaught Exception", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  log.error("Unhandled Rejection", { promise, reason });
  process.exit(1);
});

async function bootstrap() {
  try {
    const app = new App();
    const server = await app.start();

    const shutdown = (signal: string) => {
      log.info(`${signal} received, shutting down gracefully`);
      server.close(async () => {
        log.info("HTTP server closed");
        await closePool();
        log.info("Database pool closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    log.error("Failed to bootstrap application", error);
    process.exit(1);
  }
}

bootstrap();
