import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { setSession, getSession, deleteSession } from "../lib/sessionStore";
import { logger } from "../lib/logger";

const router = Router();

const SESSION_COOKIE = "vtvl_session";

router.post("/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body as {
      username?: string;
      email?: string;
      password?: string;
    };

    if (!username || !email || !password) {
      return res.status(400).json({ error: "username, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
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
    setSession(token, { userId, username, email: email.toLowerCase() });

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
    });

    return res.json({
      token,
      user: { id: userId, username, email: email.toLowerCase() },
    });
  } catch (err) {
    logger.error({ err }, "register error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
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
    setSession(token, {
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

    return res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    logger.error({ err }, "login error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) deleteSession(token);
  res.clearCookie(SESSION_COOKIE);
  return res.json({ ok: true });
});

router.get("/auth/me", (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE] ?? req.headers["x-session-token"] as string;
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
