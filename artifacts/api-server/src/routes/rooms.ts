import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { roomsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "../lib/sessionStore";
import { getRoom, createActiveRoom, serializeRoom } from "../lib/roomManager";
import { logger } from "../lib/logger";

const router = Router();

const SESSION_COOKIE = "vtvl_session";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

router.post("/rooms", async (req, res) => {
  try {
    const { type, missionId, guestName } = req.body as {
      type?: string;
      missionId?: string;
      guestName?: string;
    };

    if (!type || !["coop", "versus"].includes(type)) {
      return res.status(400).json({ error: "type must be coop or versus" });
    }
    if (!missionId) {
      return res.status(400).json({ error: "missionId is required" });
    }

    const token = req.cookies?.[SESSION_COOKIE] ?? req.headers["x-session-token"] as string;
    const session = getSession(token);

    const hostId = session?.userId ?? `guest_${uuidv4().slice(0, 8)}`;
    // Server-issued one-time secret — returned only to the room creator so the
    // creator's WebSocket can claim host authority without trusting client-supplied IDs.
    const hostSecret = uuidv4();

    let code: string;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
      if (attempts > 20) throw new Error("Failed to generate unique code");
    } while (
      (await db.select().from(roomsTable).where(eq(roomsTable.code, code)).limit(1)).length > 0
    );

    const roomId = uuidv4();
    await db.insert(roomsTable).values({
      id: roomId,
      code,
      type: type as "coop" | "versus",
      missionId,
      status: "lobby",
      hostId,
      hostSecret,
    });

    createActiveRoom(roomId, code, type as "coop" | "versus", missionId, hostId, hostSecret);

    // hostSecret is intentionally returned only here (to the creator) and never
    // from GET /rooms, so third parties cannot forge host authority.
    return res.json({
      id: roomId,
      code,
      type,
      missionId,
      status: "lobby",
      hostId,
      hostSecret,
    });
  } catch (err) {
    logger.error({ err }, "create room error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/rooms/:code", async (req, res) => {
  try {
    const { code } = req.params;

    const activeRoom = getRoom(code.toUpperCase());
    if (activeRoom) {
      return res.json({
        id: activeRoom.id,
        code: activeRoom.code,
        type: activeRoom.type,
        missionId: activeRoom.missionId,
        status: activeRoom.status,
        hostId: activeRoom.hostId,
      });
    }

    const [room] = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.code, code.toUpperCase()))
      .limit(1);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Room exists in DB but is not active in memory — the server was restarted
    // and the in-memory state is gone. Return 410 Gone so clients can show a
    // clear "room expired" message rather than entering an unjoinable lobby.
    return res.status(410).json({ error: "Room has expired" });
  } catch (err) {
    logger.error({ err }, "get room error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
