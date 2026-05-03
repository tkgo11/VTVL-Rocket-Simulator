// Session store backed by PostgreSQL with an in-memory cache.
// Sessions survive server restarts because every write is persisted to the
// `sessions` table and `loadSessionsFromDb()` rehydrates the cache on startup.

import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface SessionData {
  userId: string;
  username: string;
  email: string;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  data: SessionData;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Load all non-expired sessions from the DB into the in-memory cache.
 * Call once at server startup before accepting requests so cookie-bearing
 * clients see their session immediately after a restart.
 */
export async function loadSessionsFromDb(): Promise<void> {
  try {
    const rows = await db.select().from(sessionsTable);
    const now = Date.now();
    let loaded = 0;
    let pruned = 0;
    for (const row of rows) {
      const expires = row.expiresAt.getTime();
      if (expires <= now) {
        // Best-effort prune of expired rows
        db.delete(sessionsTable).where(eq(sessionsTable.token, row.token)).catch(() => {});
        pruned++;
        continue;
      }
      cache.set(row.token, {
        data: { userId: row.userId, username: row.username, email: row.email },
        expiresAt: expires,
      });
      loaded++;
    }
    logger.info({ loaded, pruned }, "Sessions hydrated from DB");
  } catch (err) {
    logger.error({ err }, "Failed to hydrate sessions from DB");
  }
}

export async function setSession(token: string, data: SessionData): Promise<void> {
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  const expiresAt = new Date(expiresAtMs);
  cache.set(token, { data, expiresAt: expiresAtMs });
  try {
    await db
      .insert(sessionsTable)
      .values({
        token,
        userId: data.userId,
        username: data.username,
        email: data.email,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: sessionsTable.token,
        set: {
          userId: data.userId,
          username: data.username,
          email: data.email,
          expiresAt,
        },
      });
  } catch (err) {
    logger.error({ err }, "Failed to persist session");
  }
}

export function getSession(token: string | undefined): SessionData | null {
  if (!token) return null;
  const entry = cache.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(token);
    db.delete(sessionsTable).where(eq(sessionsTable.token, token)).catch(() => {});
    return null;
  }
  return entry.data;
}

export async function deleteSession(token: string): Promise<void> {
  cache.delete(token);
  try {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  } catch (err) {
    logger.error({ err }, "Failed to delete session");
  }
}
