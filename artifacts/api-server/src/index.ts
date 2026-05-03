import { createServer } from "http";
import app from "./app";
import { setupWebSocket } from "./lib/websocket";
import { logger } from "./lib/logger";
import { loadSessionsFromDb } from "./lib/sessionStore";
import { loadRoomsFromDb } from "./lib/roomManager";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);
setupWebSocket(httpServer);

// Hydrate persisted sessions and active rooms before accepting traffic so
// reconnecting clients see their state immediately after a server restart.
await Promise.all([loadSessionsFromDb(), loadRoomsFromDb()]);

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
});

httpServer.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "Shutting down");
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
