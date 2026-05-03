import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { setSession, getSession, deleteSession } from "../lib/sessionStore";
import { logger } from "../lib/logger";

const router = Router();

const SESSION_COOKIE = "vtvl_session";

const MIN_PASSWORD_LENGTH = 12;

// Limit login and registration attempts per IP to slow brute-force and
// credential-stuffing attacks. Bcrypt operations are CPU-intensive, so
// even moderate request rates can exhaust server resources.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
  skipSuccessfulRequests: false,
});

router.post("/auth/register", authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body as {
      username?: string;
      email?: string;
      password?: string;
    };

    if (!username || !email || !password) {
      return res.status(400).json({ error: "username, email and password are required" });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const existingUsername = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (existingUsername.length > 0) {
      return res.status(400).json({ error: "Username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await db.insert(usersTable).values({
      id: userId,
      username,
      email: email.toLowerCase(),
      passwordHash,
    });

    const token = uuidv4();
    await setSession(token, { userId, username, email: email.toLowerCase() });

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
    });

    // Token is intentionally omitted from the response body.
    // Authentication is handled exclusively via the HttpOnly session cookie.
    return res.json({
      user: { id: userId, username, email: email.toLowerCase() },
    });
  } catch (err) {
    logger.error({ err }, "register error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = uuidv4();
    await setSession(token, {
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
    });

    // Token is intentionally omitted from the response body.
    // Authentication is handled exclusively via the HttpOnly session cookie.
    return res.json({
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    logger.error({ err }, "login error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await deleteSession(token);
  res.clearCookie(SESSION_COOKIE);
  return res.json({ ok: true });
});

router.get("/auth/me", (req, res) => {
  // Authentication is cookie-only; the x-session-token header is no longer accepted.
  const token = req.cookies?.[SESSION_COOKIE];
  const session = getSession(token);
  if (!session) {
    return res.json({ user: null });
  }
  return res.json({
    user: {
      id: session.userId,
      username: session.username,
      email: session.email,
    },
  });
});

export { SESSION_COOKIE };
export default router;
