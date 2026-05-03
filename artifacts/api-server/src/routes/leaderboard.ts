import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { runsTable, leaderboardTable, usersTable } from "@workspace/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import { getSession } from "../lib/sessionStore";
import { logger } from "../lib/logger";

const router = Router();

const SESSION_COOKIE = "vtvl_session";

const MAX_SCORE = 1000;
const MIN_TIME_TO_LAND = 1;

router.post("/runs", async (req, res) => {
  try {
    const {
      clientRunId,
      missionId,
      guestName,
      score,
      grade,
      crashed,
      touchdownSpeed,
      padDeviation,
      fuelRemaining,
      tiltDeg,
      flightDuration,
    } = req.body as {
      clientRunId?: string;
      missionId?: string;
      guestName?: string;
      score?: number;
      grade?: string;
      crashed?: boolean;
      touchdownSpeed?: number;
      padDeviation?: number;
      fuelRemaining?: number;
      tiltDeg?: number;
      flightDuration?: number;
    };

    if (!missionId || score === undefined || !grade || crashed === undefined) {
      return res.status(400).json({ error: "missionId, score, grade, crashed are required" });
    }

    // Sanity checks
    if (score < 0 || score > MAX_SCORE) {
      return res.status(400).json({ error: "Score out of valid range" });
    }
    if (!crashed && flightDuration !== undefined && flightDuration < MIN_TIME_TO_LAND) {
      return res.status(400).json({ error: "Flight duration implausibly short" });
    }

    // Authentication is cookie-only; x-session-token header is not accepted.
    const token = req.cookies?.[SESSION_COOKIE];
    const session = getSession(token);

    // Idempotency: if the client supplies a stable clientRunId (a UUID generated
    // per completed flight), check whether we already have a row with that ID.
    // This correctly deduplicates network-retry double-posts while allowing two
    // distinct flights that happen to share the same score/grade/name to both
    // be recorded — the old hash-based approach incorrectly dropped the second.
    const runId = (clientRunId && /^[\w-]{8,64}$/.test(clientRunId)) ? clientRunId : uuidv4();
    if (clientRunId) {
      const [existing] = await db.select({ id: runsTable.id, leaderboardId: runsTable.id })
        .from(runsTable)
        .where(eq(runsTable.id, runId))
        .limit(1);
      if (existing) {
        // Already recorded — return the existing IDs idempotently.
        const [lb] = await db.select({ id: leaderboardTable.id })
          .from(leaderboardTable)
          .where(eq(leaderboardTable.runId, runId))
          .limit(1);
        return res.json({ id: existing.id, leaderboardId: lb?.id ?? null });
      }
    }
    await db.insert(runsTable).values({
      id: runId,
      userId: session?.userId ?? null,
      guestName: session ? session.username : (guestName ?? "Anonymous"),
      missionId,
      score,
      grade,
      crashed,
      touchdownSpeed: touchdownSpeed ?? null,
      padDeviation: padDeviation ?? null,
      fuelRemaining: fuelRemaining ?? null,
      tiltDeg: tiltDeg ?? null,
      flightDuration: flightDuration ?? null,
    });

    let leaderboardId: string | null = null;

    // Only put on leaderboard if not crashed
    if (!crashed) {
      const leId = uuidv4();
      const displayName = session ? session.username : (guestName ?? "Anonymous");
      await db.insert(leaderboardTable).values({
        id: leId,
        runId,
        userId: session?.userId ?? null,
        displayName,
        missionId,
        score,
        grade,
      });
      leaderboardId = leId;
    }

    return res.json({ id: runId, leaderboardId });
  } catch (err) {
    logger.error({ err }, "submit run error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/leaderboard", async (req, res) => {
  try {
    const missionId = req.query["missionId"] as string | undefined;
    const guestName = req.query["guestName"] as string | undefined;
    const limit = Math.min(parseInt(req.query["limit"] as string ?? "50", 10), 100);

    const conditions = [];
    if (missionId) {
      conditions.push(eq(leaderboardTable.missionId, missionId));
    }

    const entries = await db
      .select()
      .from(leaderboardTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leaderboardTable.score), desc(leaderboardTable.createdAt))
      .limit(limit);

    // Authentication is cookie-only; x-session-token header is not accepted.
    const token = req.cookies?.[SESSION_COOKIE];
    const session = getSession(token);

    let personalBest: {
      displayName: string;
      score: number;
      grade: string;
      missionId: string;
      createdAt: string;
      rank: number | null;
    } | null = null;

    const pbConditions = [] as ReturnType<typeof eq>[];
    if (missionId) pbConditions.push(eq(leaderboardTable.missionId, missionId));

    if (session) {
      pbConditions.push(eq(leaderboardTable.userId, session.userId));
    } else if (guestName) {
      pbConditions.push(isNull(leaderboardTable.userId));
      pbConditions.push(eq(leaderboardTable.displayName, guestName));
    }

    if (session || guestName) {
      const [best] = await db
        .select()
        .from(leaderboardTable)
        .where(pbConditions.length > 0 ? and(...pbConditions) : undefined)
        .orderBy(desc(leaderboardTable.score), desc(leaderboardTable.createdAt))
        .limit(1);

      if (best) {
        // Compute exact rank only when it is cheap (score is in the page we
        // already fetched). Otherwise leave null and let the UI render
        // "outside top N".
        const idxInPage = entries.findIndex((e) => e.id === best.id);
        personalBest = {
          displayName: best.displayName,
          score: best.score,
          grade: best.grade,
          missionId: best.missionId,
          createdAt: best.createdAt.toISOString(),
          rank: idxInPage >= 0 ? idxInPage + 1 : null,
        };
      }
    }

    return res.json({
      entries: entries.map((e) => ({
        id: e.id,
        displayName: e.displayName,
        userId: e.userId,
        missionId: e.missionId,
        score: e.score,
        grade: e.grade,
        createdAt: e.createdAt.toISOString(),
      })),
      personalBest,
    });
  } catch (err) {
    logger.error({ err }, "leaderboard error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/players/:userId/runs", async (req, res) => {
  try {
    const { userId } = req.params;

    // Run history is private — only the account owner may read it.
    // Authentication is cookie-only; x-session-token header is not accepted.
    const token = req.cookies?.[SESSION_COOKIE];
    const session = getSession(token);
    if (!session || session.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const rawLimit = parseInt(req.query["limit"] as string ?? "", 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 25, 1), 100);

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Player not found" });
    }

    const runs = await db
      .select()
      .from(runsTable)
      .where(eq(runsTable.userId, userId))
      .orderBy(desc(runsTable.createdAt))
      .limit(limit);

    return res.json({
      runs: runs.map((r) => ({
        id: r.id,
        missionId: r.missionId,
        score: r.score,
        grade: r.grade,
        crashed: r.crashed,
        touchdownSpeed: r.touchdownSpeed,
        padDeviation: r.padDeviation,
        fuelRemaining: r.fuelRemaining,
        tiltDeg: r.tiltDeg,
        flightDuration: r.flightDuration,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error({ err }, "player runs error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/players/:userId/stats", async (req, res) => {
  try {
    const { userId } = req.params;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Player not found" });
    }

    const runs = await db
      .select()
      .from(runsTable)
      .where(eq(runsTable.userId, userId));

    const totalFlights = runs.length;
    const successes = runs.filter((r) => !r.crashed);
    const successRate = totalFlights > 0 ? successes.length / totalFlights : 0;

    let bestScore: number | null = null;
    let bestGrade: string | null = null;

    for (const r of successes) {
      if (bestScore === null || r.score > bestScore) {
        bestScore = r.score;
        bestGrade = r.grade;
      }
    }

    return res.json({
      userId,
      username: user.username,
      totalFlights,
      bestScore,
      bestGrade,
      successRate,
    });
  } catch (err) {
    logger.error({ err }, "player stats error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
