import { WebSocket } from "ws";
import { db } from "@workspace/db";
import { roomsTable, roomPlayersTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "./logger";

export type RoomType = "coop" | "versus";
export type ParticipantRole = "player" | "spectator";

export interface RocketState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  throttle: number;
  gimbal: number;
  fuel: number;
  status: string;
  t: number;
}

export interface RoomPlayer {
  id: string;
  displayName: string;
  userId?: string;
  role: ParticipantRole;
  ready: boolean;
  finished: boolean;
  score?: number;
  grade?: string;
  crashed?: boolean;
  rocketState?: RocketState;
  /**
   * The active WebSocket for this player, or null when the player has been
   * hydrated from the DB after a server restart and no socket has reattached
   * yet. `disconnected` is true whenever ws is null.
   */
  ws: WebSocket | null;
  lastHeartbeat: number;
  /** True when the WebSocket has closed but the grace-period timer is still running. */
  disconnected?: boolean;
  /**
   * Server-issued per-player secret. Required alongside playerId on reconnect
   * so that knowing another player's ID (visible in room payloads) is not enough
   * to hijack their slot during the disconnect grace period.
   */
  reconnectSecret: string;
}

export interface ActiveRoom {
  id: string;
  code: string;
  type: RoomType;
  missionId: string;
  status: "lobby" | "in_progress" | "ended";
  hostId: string;
  /**
   * Server-issued secret returned only from POST /rooms to the creator.
   * Required alongside playerId to claim host identity over WebSocket.
   * Never exposed through GET /rooms.
   */
  hostSecret: string;
  /** missionId of the currently active round (set on start_round, cleared on end_round). */
  currentMissionId?: string;
  /** Seed for the currently active round (set on start_round). */
  currentSeed?: number;
  players: Map<string, RoomPlayer>;
  /** NodeJS timer that ends a versus round if not all players finish in time. */
  roundTimeoutHandle?: ReturnType<typeof setTimeout>;
}

/**
 * Active rooms and per-WS bookkeeping live in memory for fast lookups, but
 * every mutation that changes durable state (room status, host, player roster,
 * player progress) is mirrored to the `rooms` and `room_players` tables so the
 * roster can be rebuilt after a server restart via `loadRoomsFromDb()`.
 */
const rooms = new Map<string, ActiveRoom>();
// Map ws → { roomCode, playerId }
const wsToRoom = new Map<WebSocket, { roomCode: string; playerId: string }>();
// Map playerId → { roomCode, disconnectTimer }
const disconnectTimers = new Map<string, { roomCode: string; handle: ReturnType<typeof setTimeout> }>();

const DISCONNECT_GRACE_MS = 10_000;

// ---------- Persistence helpers (fire-and-forget) ----------

function persistRoomState(room: ActiveRoom): void {
  db.update(roomsTable)
    .set({
      status: room.status,
      hostId: room.hostId,
      currentMissionId: room.currentMissionId ?? null,
      currentSeed: room.currentSeed ?? null,
      endedAt: room.status === "ended" ? new Date() : null,
    })
    .where(eq(roomsTable.id, room.id))
    .catch((err) => logger.error({ err, roomId: room.id }, "persistRoomState failed"));
}

function persistPlayer(roomId: string, player: RoomPlayer): void {
  db.insert(roomPlayersTable)
    .values({
      roomId,
      playerId: player.id,
      displayName: player.displayName,
      userId: player.userId ?? null,
      role: player.role,
      ready: player.ready,
      finished: player.finished,
      score: player.score ?? null,
      grade: player.grade ?? null,
      crashed: player.crashed ?? null,
      reconnectSecret: player.reconnectSecret,
    })
    .onConflictDoUpdate({
      target: [roomPlayersTable.roomId, roomPlayersTable.playerId],
      set: {
        displayName: player.displayName,
        userId: player.userId ?? null,
        role: player.role,
        ready: player.ready,
        finished: player.finished,
        score: player.score ?? null,
        grade: player.grade ?? null,
        crashed: player.crashed ?? null,
        reconnectSecret: player.reconnectSecret,
      },
    })
    .catch((err) => logger.error({ err, roomId, playerId: player.id }, "persistPlayer failed"));
}

function deletePlayerRow(roomId: string, playerId: string): void {
  db.delete(roomPlayersTable)
    .where(and(eq(roomPlayersTable.roomId, roomId), eq(roomPlayersTable.playerId, playerId)))
    .catch((err) => logger.error({ err, roomId, playerId }, "deletePlayerRow failed"));
}

function markRoomEnded(room: ActiveRoom): void {
  room.status = "ended";
  db.update(roomsTable)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(roomsTable.id, room.id))
    .catch((err) => logger.error({ err, roomId: room.id }, "markRoomEnded failed"));
}

/** Persist a single field of the player. Convenience for callers in websocket.ts. */
export function savePlayer(room: ActiveRoom, player: RoomPlayer): void {
  persistPlayer(room.id, player);
}

/** Persist room status / host / current round info. */
export function saveRoom(room: ActiveRoom): void {
  persistRoomState(room);
}

// ---------- Startup hydration ----------

/**
 * Rebuild active room state from the DB. Called once on server startup so a
 * restart no longer evaporates rooms in lobby/in-progress status. All hydrated
 * players come back with `ws=null, disconnected=true` so a returning client
 * can re-attach by sending its playerId + reconnectSecret in `join_room`.
 */
export async function loadRoomsFromDb(): Promise<void> {
  try {
    const dbRooms = await db
      .select()
      .from(roomsTable)
      .where(inArray(roomsTable.status, ["lobby", "in_progress"]));

    if (dbRooms.length === 0) {
      logger.info("No active rooms to hydrate");
      return;
    }

    const dbPlayers = await db
      .select()
      .from(roomPlayersTable)
      .where(inArray(roomPlayersTable.roomId, dbRooms.map((r) => r.id)));

    const playersByRoom = new Map<string, typeof dbPlayers>();
    for (const p of dbPlayers) {
      const list = playersByRoom.get(p.roomId) ?? [];
      list.push(p);
      playersByRoom.set(p.roomId, list);
    }

    for (const r of dbRooms) {
      const room: ActiveRoom = {
        id: r.id,
        code: r.code,
        type: r.type as RoomType,
        missionId: r.missionId,
        status: r.status as "lobby" | "in_progress",
        hostId: r.hostId,
        hostSecret: r.hostSecret ?? "",
        currentMissionId: r.currentMissionId ?? undefined,
        currentSeed: r.currentSeed ?? undefined,
        players: new Map(),
      };
      const ps = playersByRoom.get(r.id) ?? [];
      for (const p of ps) {
        room.players.set(p.playerId, {
          id: p.playerId,
          displayName: p.displayName,
          userId: p.userId ?? undefined,
          role: p.role as ParticipantRole,
          ready: p.ready,
          finished: p.finished,
          score: p.score ?? undefined,
          grade: p.grade ?? undefined,
          crashed: p.crashed ?? undefined,
          ws: null,
          lastHeartbeat: Date.now(),
          disconnected: true,
          reconnectSecret: p.reconnectSecret,
        });
      }
      rooms.set(r.code, room);
    }

    logger.info({ rooms: dbRooms.length, players: dbPlayers.length }, "Rooms hydrated from DB");
  } catch (err) {
    logger.error({ err }, "Failed to hydrate rooms from DB");
  }
}

// ---------- Public API ----------

export function createActiveRoom(
  id: string,
  code: string,
  type: RoomType,
  missionId: string,
  hostId: string,
  hostSecret: string,
): ActiveRoom {
  const room: ActiveRoom = {
    id,
    code,
    type,
    missionId,
    status: "lobby",
    hostId,
    hostSecret,
    players: new Map(),
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): ActiveRoom | undefined {
  return rooms.get(code);
}

export function addPlayerToRoom(
  room: ActiveRoom,
  player: RoomPlayer,
): void {
  room.players.set(player.id, player);
  if (player.ws) {
    wsToRoom.set(player.ws, { roomCode: room.code, playerId: player.id });
  }
  persistPlayer(room.id, player);
}

/**
 * Called when a WebSocket closes. Instead of immediately evicting the player,
 * we start a grace-period timer. The player is marked as disconnected but stays
 * in the room so others can see they are temporarily absent. If the player
 * reconnects (via `restorePlayerConnection`) before the timer fires, the timer
 * is cancelled and the player rejoins seamlessly.
 *
 * Returns { room, player } so the caller can broadcast `player_disconnected`.
 */
export function handlePlayerDisconnect(ws: WebSocket, onEvict: (room: ActiveRoom, player: RoomPlayer) => void): { room: ActiveRoom; player: RoomPlayer } | null {
  const entry = wsToRoom.get(ws);
  if (!entry) return null;
  wsToRoom.delete(ws);

  const room = rooms.get(entry.roomCode);
  if (!room) return null;

  const player = room.players.get(entry.playerId);
  if (!player) return null;

  player.disconnected = true;
  player.ws = null;

  // Cancel any previous pending timer for this player (shouldn't happen, but be safe).
  const existing = disconnectTimers.get(player.id);
  if (existing) clearTimeout(existing.handle);

  const handle = setTimeout(() => {
    disconnectTimers.delete(player.id);
    evictPlayer(room, player, onEvict);
  }, DISCONNECT_GRACE_MS);

  disconnectTimers.set(player.id, { roomCode: room.code, handle });

  return { room, player };
}

/**
 * Remove the wsToRoom mapping for a WebSocket WITHOUT triggering disconnect
 * logic. Call this before explicitly closing a socket that is being replaced
 * (e.g. duplicate active connection) so the close-event's handlePlayerDisconnect
 * call finds no entry and returns early, leaving the new connection untouched.
 */
export function removeWsMapping(ws: WebSocket): void {
  wsToRoom.delete(ws);
}

/**
 * Cancel an in-flight disconnect timer for a player. Call this before replacing
 * a disconnected player entry (e.g. on fresh re-join / page reload) so the
 * stale timer cannot fire and evict the new connection.
 */
export function cancelDisconnectTimer(playerId: string): void {
  const timer = disconnectTimers.get(playerId);
  if (timer) {
    clearTimeout(timer.handle);
    disconnectTimers.delete(playerId);
  }
}

function evictPlayer(room: ActiveRoom, player: RoomPlayer, onEvict: (room: ActiveRoom, player: RoomPlayer) => void): void {
  // Object-identity guard: if the player slot was replaced by a fresh reconnection
  // (page reload creating a new RoomPlayer at the same ID), the map holds a
  // different object. Bail out so the new connection is not evicted.
  if (room.players.get(player.id) !== player) return;

  room.players.delete(player.id);
  deletePlayerRow(room.id, player.id);

  // Clean up empty rooms
  if (room.players.size === 0) {
    rooms.delete(room.code);
    markRoomEnded(room);
  } else if (room.hostId === player.id) {
    // Transfer host to first connected player, or any player if all are disconnected
    const next = Array.from(room.players.values()).find((p) => !p.disconnected) ?? room.players.values().next().value;
    if (next) {
      room.hostId = next.id;
      persistRoomState(room);
    }
  }

  onEvict(room, player);
}

/**
 * Attempt to restore a reconnecting player's connection. Both `playerId` and
 * `reconnectSecret` must match to prevent slot hijacking by clients that happen
 * to know another player's ID from a room payload.
 *
 * Returns the existing RoomPlayer on success, or null if the identity cannot
 * be verified or the player is not in the disconnect grace period.
 */
export function restorePlayerConnection(room: ActiveRoom, playerId: string, reconnectSecret: string, newWs: WebSocket): RoomPlayer | null {
  const player = room.players.get(playerId);
  if (!player || !player.disconnected) return null;
  // Reject if the secret doesn't match — prevents slot hijacking.
  if (player.reconnectSecret !== reconnectSecret) return null;

  // Cancel the eviction timer
  const timer = disconnectTimers.get(playerId);
  if (timer) {
    clearTimeout(timer.handle);
    disconnectTimers.delete(playerId);
  }

  // Swap the WebSocket
  player.ws = newWs;
  player.disconnected = false;
  player.lastHeartbeat = Date.now();
  wsToRoom.set(newWs, { roomCode: room.code, playerId });

  return player;
}

export function removePlayerFromRoom(ws: WebSocket): { room: ActiveRoom; player: RoomPlayer } | null {
  const entry = wsToRoom.get(ws);
  if (!entry) return null;
  wsToRoom.delete(ws);

  const room = rooms.get(entry.roomCode);
  if (!room) return null;

  const player = room.players.get(entry.playerId);
  if (!player) return null;

  room.players.delete(entry.playerId);
  deletePlayerRow(room.id, entry.playerId);

  // Clean up empty rooms
  if (room.players.size === 0) {
    rooms.delete(room.code);
    markRoomEnded(room);
  } else if (room.hostId === player.id) {
    const next = room.players.values().next().value;
    if (next) {
      room.hostId = next.id;
      persistRoomState(room);
    }
  }

  return { room, player };
}

export function getRoomByWs(ws: WebSocket): { room: ActiveRoom; player: RoomPlayer } | null {
  const entry = wsToRoom.get(ws);
  if (!entry) return null;
  const room = rooms.get(entry.roomCode);
  if (!room) return null;
  const player = room.players.get(entry.playerId);
  if (!player) return null;
  return { room, player };
}

export function broadcastToRoom(room: ActiveRoom, msg: object, excludeWs?: WebSocket): void {
  const json = JSON.stringify(msg);
  for (const p of room.players.values()) {
    if (p.disconnected || !p.ws) continue;
    if (p.ws !== excludeWs && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(json);
    }
  }
}

export function sendToPlayer(player: RoomPlayer, msg: object): void {
  if (!player.disconnected && player.ws && player.ws.readyState === WebSocket.OPEN) {
    player.ws.send(JSON.stringify(msg));
  }
}

export function serializeRoom(room: ActiveRoom) {
  return {
    id: room.id,
    code: room.code,
    type: room.type,
    missionId: room.missionId,
    status: room.status,
    hostId: room.hostId,
    // Include active-round info so late joiners (e.g. spectators) can jump
    // straight into the simulator without waiting for the next round.
    ...(room.status === "in_progress" && {
      currentMissionId: room.currentMissionId,
      currentSeed: room.currentSeed,
    }),
    players: Array.from(room.players.values()).map(serializePlayer),
  };
}

export function serializePlayer(p: RoomPlayer) {
  return {
    id: p.id,
    displayName: p.displayName,
    userId: p.userId,
    role: p.role,
    ready: p.ready,
    finished: p.finished,
    score: p.score,
    grade: p.grade,
    crashed: p.crashed,
    rocketState: p.rocketState,
    disconnected: p.disconnected ?? false,
  };
}

export function checkAllFinished(room: ActiveRoom): boolean {
  const players = Array.from(room.players.values()).filter((p) => p.role === "player" && !p.disconnected);
  return players.length > 0 && players.every((p) => p.finished);
}

export function getRoundResults(room: ActiveRoom) {
  return Array.from(room.players.values())
    .filter((p) => p.role === "player")
    .map((p) => ({
      playerId: p.id,
      displayName: p.displayName,
      score: p.score ?? 0,
      grade: p.grade ?? "F",
      crashed: p.crashed ?? true,
    }))
    .sort((a, b) => b.score - a.score);
}

/** End the current round (called by timeout or when all players finish). */
export function endRound(room: ActiveRoom): void {
  if (room.roundTimeoutHandle) {
    clearTimeout(room.roundTimeoutHandle);
    room.roundTimeoutHandle = undefined;
  }
  room.status = "lobby";
  room.currentMissionId = undefined;
  room.currentSeed = undefined;
  for (const p of room.players.values()) {
    p.finished = false;
    p.ready = false;
    persistPlayer(room.id, p);
  }
  persistRoomState(room);
}
