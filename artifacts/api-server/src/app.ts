import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the first hop of forwarded headers (Replit's reverse proxy).
// This ensures req.ip reflects the real client address so that IP-based
// rate limiting in express-rate-limit operates per-client rather than
// treating all requests as originating from the shared proxy IP.
app.set("trust proxy", 1);

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

// CORS: allow only the exact configured frontend origin.
// Set ALLOWED_ORIGIN to the deployed frontend URL in production.
// In development without ALLOWED_ORIGIN, only localhost is trusted
// (the dev proxy serves frontend and API on the same origin so
// same-origin browser requests never require CORS headers anyway).
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

const DEV_ORIGINS: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin / non-browser requests (no Origin header)
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGIN) {
        // Production: only the exact configured origin is trusted
        const allowed = origin === ALLOWED_ORIGIN;
        return callback(
          allowed ? null : new Error("CORS: origin not allowed"),
          allowed,
        );
      }

      // Development fallback: localhost only
      const allowed = DEV_ORIGINS.some((re) => re.test(origin));
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
