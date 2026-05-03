import { WebSocket } from "ws";

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
  ws: WebSocket;
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
 * All state below is in-memory only. A server restart drops all active rooms,
 * sessions, and disconnect timers — rooms are ephemeral by design (share link,
 * play, done). For durable room/session persistence, replace these maps with a
 * Redis or PostgreSQL-backed store.
 */
// In-memory room store keyed by room code
const rooms = new Map<string, ActiveRoom>();
// Map ws → { roomCode, playerId }
const wsToRoom = new Map<WebSocket, { roomCode: string; playerId: string }>();
// Map playerId → { roomCode, disconnectTimer }
const disconnectTimers = new Map<string, { roomCode: string; handle: ReturnType<typeof setTimeout> }>();

const DISCONNECT_GRACE_MS = 10_000;

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
  wsToRoom.set(player.ws, { roomCode: room.code, playerId: player.id });
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

  // Clean up empty rooms
  if (room.players.size === 0) {
    rooms.delete(room.code);
  } else if (room.hostId === player.id) {
    // Transfer host to first connected player, or any player if all are disconnected
    const next = Array.from(room.players.values()).find((p) => !p.disconnected) ?? room.players.values().next().value;
    if (next) room.hostId = next.id;
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

  // Clean up empty rooms
  if (room.players.size === 0) {
    rooms.delete(room.code);
  } else if (room.hostId === player.id) {
    const next = room.players.values().next().value;
    if (next) room.hostId = next.id;
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
    if (p.disconnected) continue;
    if (p.ws !== excludeWs && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(json);
    }
  }
}

export function sendToPlayer(player: RoomPlayer, msg: object): void {
  if (!player.disconnected && player.ws.readyState === WebSocket.OPEN) {
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
  for (const p of room.players.values()) {
    p.finished = false;
    p.ready = false;
  }
}
