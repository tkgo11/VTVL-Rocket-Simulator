import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server } from "http";
import { v4 as uuidv4 } from "uuid";
import { parse as parseCookies } from "cookie";
import {
  getRoom,
  addPlayerToRoom,
  handlePlayerDisconnect,
  restorePlayerConnection,
  cancelDisconnectTimer,
  removeWsMapping,
  getRoomByWs,
  removePlayerFromRoom,
  broadcastToRoom,
  serializeRoom,
  serializePlayer,
  checkAllFinished,
  getRoundResults,
  endRound,
  savePlayer,
  saveRoom,
  type RoomPlayer,
  type RocketState,
} from "./roomManager";
import { getSession } from "./sessionStore";
import { logger } from "./logger";

const SESSION_COOKIE = "vtvl_session";

/** Versus rounds auto-end after this many milliseconds if not all players finish. */
const VERSUS_ROUND_TIMEOUT_MS = 5 * 60 * 1000;

type ClientMsg =
  | { type: "join_room"; roomCode: string; role: "player" | "spectator"; displayName: string; playerId?: string; hostSecret?: string; reconnectSecret?: string }
  | { type: "leave_room" }
  | { type: "rocket_state"; state: RocketState }
  | { type: "player_ready"; ready: boolean }
  | { type: "start_round" }
  | { type: "submit_result"; score: number; grade: string; crashed: boolean }
  | { type: "heartbeat" };

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    // Resolve session from the HttpOnly cookie sent with the WS upgrade request.
    // The token field in join_room messages is no longer accepted — authentication
    // is cookie-only to prevent localStorage token theft being replayed via WS.
    const cookieHeader = req.headers.cookie ?? "";
    const cookies = parseCookies(cookieHeader);
    const sessionToken = cookies[SESSION_COOKIE];
    const session = getSession(sessionToken);

    logger.info({ sessionUserId: session?.userId }, "WS connected");

    const heartbeatInterval = setInterval(() => {
      const entry = getRoomByWs(ws);
      if (entry) {
        entry.player.lastHeartbeat = Date.now();
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "heartbeat_ack" }));
      }
    }, 20000);

    ws.on("message", (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString()) as ClientMsg;
      } catch {
        ws.send(JSON.stringify({ type: "error", code: "PARSE_ERROR", message: "Invalid JSON" }));
        return;
      }

      try {
        handleMessage(ws, msg, session);
      } catch (err) {
        logger.error({ err }, "WS message handler error");
        ws.send(JSON.stringify({ type: "error", code: "INTERNAL", message: "Server error" }));
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeatInterval);

      // Use grace-period disconnect — player stays in room for DISCONNECT_GRACE_MS
      // before being evicted, allowing seamless reconnection.
      const entry = handlePlayerDisconnect(ws, (room, player) => {
        logger.info({ roomCode: room.code, playerId: player.id }, "Player evicted after disconnect grace period");
        broadcastToRoom(room, { type: "player_left", playerId: player.id });
      });

      if (entry) {
        const { room, player } = entry;
        logger.info({ roomCode: room.code, playerId: player.id }, "Player disconnected (grace period started)");
        broadcastToRoom(room, { type: "player_disconnected", playerId: player.id, reconnectWindowMs: 10000 }, ws);
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WS error");
    });
  });

  return wss;
}

function finishRound(room: ReturnType<typeof getRoom> & object): void {
  const results = getRoundResults(room);
  endRound(room);
  broadcastToRoom(room, { type: "round_ended", results });
}

function handleMessage(
  ws: WebSocket,
  msg: ClientMsg,
  session: { userId: string; username: string; email: string } | null,
): void {
  switch (msg.type) {
    case "join_room": {
      const code = msg.roomCode?.toUpperCase();
      const room = getRoom(code);

      if (!room) {
        ws.send(
          JSON.stringify({ type: "error", code: "ROOM_NOT_FOUND", message: `Room ${code} not found` }),
        );
        return;
      }

      if (room.status === "ended") {
        ws.send(JSON.stringify({ type: "error", code: "ROOM_ENDED", message: "Room has ended" }));
        return;
      }

      // Check if this is a reconnecting player.
      // Authenticated users are identified by their verified session cookie.
      // Guests must supply both playerId AND reconnectSecret (issued on original join)
      // to prevent another client from hijacking a disconnected guest's slot.
      const candidateId = session?.userId ?? msg.playerId;
      const candidateSecret = msg.reconnectSecret ?? "";
      if (candidateId) {
        const restored = restorePlayerConnection(room, candidateId, candidateSecret, ws);
        if (restored) {
          logger.info({ roomCode: code, playerId: candidateId }, "Player reconnected");
          ws.send(JSON.stringify({
            type: "room_joined",
            room: serializeRoom(room),
            you: { id: restored.id, displayName: restored.displayName, role: restored.role, reconnectSecret: restored.reconnectSecret },
            reconnected: true,
          }));
          broadcastToRoom(room, { type: "player_reconnected", playerId: restored.id }, ws);
          return;
        }
      }

      // For authenticated users, identity comes from the verified session cookie.
      // For guests claiming host authority, they must supply both the correct playerId
      // AND the server-issued hostSecret (returned only from POST /rooms to the creator).
      // This prevents anyone who merely knows the room code from impersonating the host.
      const isHostClaim =
        msg.playerId &&
        msg.playerId === room.hostId &&
        msg.hostSecret === room.hostSecret;
      const playerId =
        session?.userId ??
        (isHostClaim ? msg.playerId! : `guest_${uuidv4().slice(0, 8)}`);
      const displayName =
        session?.username ?? msg.displayName ?? `Pilot-${playerId.slice(-4)}`;

      const role = msg.role ?? "player";

      // Generate a per-player reconnect secret. This is sent to the client on
      // initial join and must be returned on reconnect alongside the playerId to
      // prevent slot hijacking during the disconnect grace period.
      const reconnectSecret = uuidv4();

      const player: RoomPlayer = {
        id: playerId,
        displayName,
        userId: session?.userId,
        role,
        ready: false,
        finished: false,
        rocketState: undefined,
        ws,
        lastHeartbeat: Date.now(),
        reconnectSecret,
      };

      // If the same playerId is already in the room, handle both cases atomically:
      // - Disconnected (grace period): cancel the stale eviction timer so it cannot
      //   fire and remove the new connection after we replace the slot.
      // - Active duplicate (two tabs / concurrent sockets): close the old WS first.
      // In both cases delete the old entry before addPlayerToRoom.
      const existing = room.players.get(playerId);
      if (existing) {
        if (existing.disconnected) {
          logger.info({ roomCode: code, playerId }, "Fresh rejoin over disconnected slot — cancelling eviction timer");
          cancelDisconnectTimer(playerId);
        } else if (existing.ws) {
          logger.info({ roomCode: code, playerId }, "Replacing duplicate active socket for same player");
          // Unlink the old WS from wsToRoom BEFORE closing it so the close-event's
          // handlePlayerDisconnect call finds no entry and exits early, preventing
          // it from marking the newly inserted player as disconnected.
          removeWsMapping(existing.ws);
          existing.ws.close(1001, "replaced by new connection");
        }
        room.players.delete(playerId);
      }

      addPlayerToRoom(room, player);

      logger.info({ roomCode: code, playerId, role }, "Player joined room");

      // Tell the joining player their room state + reconnect secret.
      // reconnectSecret is only ever sent to the specific player (not broadcast).
      ws.send(
        JSON.stringify({
          type: "room_joined",
          room: serializeRoom(room),
          you: { id: playerId, displayName, role, reconnectSecret },
        }),
      );

      // Tell everyone else
      broadcastToRoom(
        room,
        { type: "player_joined", player: serializePlayer(player) },
        ws,
      );
      break;
    }

    case "leave_room": {
      // Use centralised removePlayerFromRoom so wsToRoom is cleaned up,
      // host is transferred if needed, and empty rooms are deleted.
      const entry = removePlayerFromRoom(ws);
      if (entry) {
        broadcastToRoom(entry.room, { type: "player_left", playerId: entry.player.id });
      }
      break;
    }

    case "rocket_state": {
      const entry = getRoomByWs(ws);
      if (!entry) return;
      const { room, player } = entry;

      if (player.role !== "player") return;
      if (room.status !== "in_progress") return;

      player.rocketState = msg.state;

      broadcastToRoom(
        room,
        { type: "rocket_update", playerId: player.id, state: msg.state },
        ws,
      );
      break;
    }

    case "player_ready": {
      const entry = getRoomByWs(ws);
      if (!entry) return;
      const { room, player } = entry;

      player.ready = msg.ready;
      savePlayer(room, player);
      broadcastToRoom(room, {
        type: "player_ready_changed",
        playerId: player.id,
        ready: msg.ready,
      });
      break;
    }

    case "start_round": {
      const entry = getRoomByWs(ws);
      if (!entry) return;
      const { room, player } = entry;

      if (player.id !== room.hostId) {
        ws.send(
          JSON.stringify({ type: "error", code: "NOT_HOST", message: "Only the host can start" }),
        );
        return;
      }
      if (room.status !== "lobby") return;

      room.status = "in_progress";

      // Reset all players
      for (const p of room.players.values()) {
        p.finished = false;
        p.score = undefined;
        p.grade = undefined;
        p.crashed = undefined;
        p.ready = false;
        savePlayer(room, p);
      }

      // Pick a deterministic seed (ms timestamp) and store it so late joiners
      // (spectators who join mid-round) receive it in the room_joined response.
      const seed = Date.now();
      room.currentMissionId = room.missionId;
      room.currentSeed = seed;
      saveRoom(room);

      broadcastToRoom(room, {
        type: "round_starting",
        missionId: room.missionId,
        seed,
      });

      // Versus: auto-end round after timeout so the round cannot stall forever.
      if (room.type === "versus") {
        room.roundTimeoutHandle = setTimeout(() => {
          if (room.status !== "in_progress") return;
          logger.info({ roomCode: room.code }, "Versus round timed out — ending round");
          finishRound(room);
        }, VERSUS_ROUND_TIMEOUT_MS);
      }
      break;
    }

    case "submit_result": {
      const entry = getRoomByWs(ws);
      if (!entry) return;
      const { room, player } = entry;

      if (room.status !== "in_progress") return;
      if (player.role !== "player") return;
      if (player.finished) return; // idempotent — prevent double submission

      player.finished = true;
      player.score = msg.score;
      player.grade = msg.grade;
      player.crashed = msg.crashed;
      savePlayer(room, player);

      broadcastToRoom(room, {
        type: "player_result",
        playerId: player.id,
        displayName: player.displayName,
        score: msg.score,
        grade: msg.grade,
        crashed: msg.crashed,
      });

      // Check if all connected players finished
      if (checkAllFinished(room)) {
        finishRound(room);
      }
      break;
    }

    case "heartbeat": {
      const entry = getRoomByWs(ws);
      if (entry) {
        entry.player.lastHeartbeat = Date.now();
      }
      ws.send(JSON.stringify({ type: "heartbeat_ack" }));
      break;
    }

    default:
      ws.send(JSON.stringify({ type: "error", code: "UNKNOWN_MSG", message: "Unknown message type" }));
  }
}
