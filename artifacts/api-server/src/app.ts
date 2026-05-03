import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Lock CORS to explicit trusted origins.
// In production, only the Replit deployment domain is trusted.
// In development, also allow localhost and the Replit dev proxy domain.
const TRUSTED_ORIGINS: (string | RegExp)[] = [
  // Replit dev proxy: https://<REPL_ID>.replit.dev
  /^https?:\/\/[a-zA-Z0-9-]+\.replit\.dev(:\d+)?$/,
  // Replit deployment domains
  /^https:\/\/[a-zA-Z0-9-]+\.replit\.app$/,
  // Local development
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin / non-browser requests (no origin header)
      if (!origin) return callback(null, true);
      const allowed = TRUSTED_ORIGINS.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin),
      );
      callback(allowed ? null : new Error("CORS: origin not allowed"), allowed);
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
