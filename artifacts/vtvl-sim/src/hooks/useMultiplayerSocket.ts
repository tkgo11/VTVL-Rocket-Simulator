import { useEffect, useRef, useCallback, useState } from 'react';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface RocketState {
  x: number; y: number; vx: number; vy: number;
  angle: number; angularVelocity: number;
  throttle: number; gimbal: number; fuel: number;
  status: string; t: number;
}

export interface RemotePlayer {
  id: string;
  displayName: string;
  userId?: string;
  role: 'player' | 'spectator';
  ready: boolean;
  finished: boolean;
  score?: number;
  grade?: string;
  crashed?: boolean;
  rocketState?: RocketState;
  disconnected?: boolean;
}

export interface RoomInfo {
  id: string;
  code: string;
  type: 'coop' | 'versus';
  missionId: string;
  status: 'lobby' | 'in_progress' | 'ended';
  hostId: string;
  /** Present only when status is 'in_progress' — lets late joiners (spectators) start directly. */
  currentMissionId?: string;
  currentSeed?: number;
  players: RemotePlayer[];
}

export interface RoundResult {
  playerId: string;
  displayName: string;
  score: number;
  grade: string;
  crashed: boolean;
}

export type ServerMsg =
  | { type: 'room_joined'; room: RoomInfo; you: { id: string; displayName: string; role: string; reconnectSecret?: string }; reconnected?: boolean }
  | { type: 'player_joined'; player: RemotePlayer }
  | { type: 'player_left'; playerId: string }
  | { type: 'player_disconnected'; playerId: string; reconnectWindowMs: number }
  | { type: 'player_reconnected'; playerId: string }
  | { type: 'rocket_update'; playerId: string; state: RocketState }
  | { type: 'player_ready_changed'; playerId: string; ready: boolean }
  | { type: 'round_starting'; missionId: string; seed: number }
  | { type: 'player_result'; playerId: string; displayName: string; score: number; grade: string; crashed: boolean }
  | { type: 'round_ended'; results: RoundResult[] }
  | { type: 'error'; code: string; message: string }
  | { type: 'heartbeat_ack' };

export interface MultiplayerSocketOptions {
  onRoundStarting?: (missionId: string, seed: number) => void;
  onRoundEnded?: (results: RoundResult[]) => void;
  onError?: (code: string, message: string) => void;
}

export interface UseMultiplayerSocketReturn {
  status: ConnectionStatus;
  room: RoomInfo | null;
  myId: string | null;
  remotePlayers: Map<string, RemotePlayer>;
  joinRoom: (roomCode: string, displayName: string, role?: 'player' | 'spectator', token?: string, playerId?: string, hostSecret?: string) => void;
  leaveRoom: () => void;
  sendRocketState: (state: RocketState) => void;
  setReady: (ready: boolean) => void;
  startRound: () => void;
  submitResult: (score: number, grade: string, crashed: boolean) => void;
  disconnect: () => void;
}

function getWsUrl(): string {
  const loc = window.location;
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${loc.host}/ws`;
}

export function useMultiplayerSocket(opts: MultiplayerSocketOptions = {}): UseMultiplayerSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pendingJoinRef = useRef<{
    roomCode: string;
    displayName: string;
    role: 'player' | 'spectator';
    token?: string;
    playerId?: string;
    hostSecret?: string;
    reconnectSecret?: string;
  } | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<Map<string, RemotePlayer>>(new Map());

  const sendRaw = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const handleMessage = useCallback((msg: ServerMsg) => {
    switch (msg.type) {
      case 'room_joined': {
        setRoom(msg.room);
        setMyId(msg.you.id);
        const map = new Map<string, RemotePlayer>();
        for (const p of msg.room.players) {
          map.set(p.id, p);
        }
        setRemotePlayers(map);
        // Update pendingJoin with the server-assigned playerId and reconnectSecret so
        // future reconnect attempts can restore the correct identity.
        if (pendingJoinRef.current) {
          pendingJoinRef.current.playerId = msg.you.id;
          pendingJoinRef.current.reconnectSecret = msg.you.reconnectSecret;
        }
        break;
      }
      case 'player_joined':
        setRemotePlayers((prev) => {
          const next = new Map(prev);
          next.set(msg.player.id, msg.player);
          return next;
        });
        setRoom((prev) => prev ? { ...prev, players: [...prev.players.filter(p => p.id !== msg.player.id), msg.player] } : prev);
        break;
      case 'player_left':
        setRemotePlayers((prev) => {
          const next = new Map(prev);
          next.delete(msg.playerId);
          return next;
        });
        setRoom((prev) => prev ? { ...prev, players: prev.players.filter(p => p.id !== msg.playerId) } : prev);
        break;
      case 'player_disconnected':
        // Mark the player as temporarily disconnected (grace period active).
        setRemotePlayers((prev) => {
          const player = prev.get(msg.playerId);
          if (!player) return prev;
          const next = new Map(prev);
          next.set(msg.playerId, { ...player, disconnected: true });
          return next;
        });
        break;
      case 'player_reconnected':
        // Clear the disconnected flag when the player comes back.
        setRemotePlayers((prev) => {
          const player = prev.get(msg.playerId);
          if (!player) return prev;
          const next = new Map(prev);
          next.set(msg.playerId, { ...player, disconnected: false });
          return next;
        });
        break;
      case 'rocket_update':
        setRemotePlayers((prev) => {
          const player = prev.get(msg.playerId);
          if (!player) return prev;
          const next = new Map(prev);
          next.set(msg.playerId, { ...player, rocketState: msg.state });
          return next;
        });
        break;
      case 'player_ready_changed':
        setRemotePlayers((prev) => {
          const player = prev.get(msg.playerId);
          if (!player) return prev;
          const next = new Map(prev);
          next.set(msg.playerId, { ...player, ready: msg.ready });
          return next;
        });
        break;
      case 'round_starting':
        setRoom((prev) => prev ? { ...prev, status: 'in_progress' } : prev);
        optsRef.current.onRoundStarting?.(msg.missionId, msg.seed);
        break;
      case 'player_result':
        setRemotePlayers((prev) => {
          const player = prev.get(msg.playerId);
          if (!player) return prev;
          const next = new Map(prev);
          next.set(msg.playerId, { ...player, finished: true, score: msg.score, grade: msg.grade, crashed: msg.crashed });
          return next;
        });
        break;
      case 'round_ended':
        setRoom((prev) => prev ? { ...prev, status: 'lobby' } : prev);
        optsRef.current.onRoundEnded?.(msg.results);
        break;
      case 'error':
        optsRef.current.onError?.(msg.code, msg.message);
        break;
      case 'heartbeat_ack':
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;

    setStatus('connecting');
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setStatus('connected');

      // Re-join room if pending. Include playerId + reconnectSecret for guest reconnection
      // identity verification, and hostSecret for host authority claims.
      if (pendingJoinRef.current) {
        const { roomCode, displayName, role, token, playerId, hostSecret, reconnectSecret } = pendingJoinRef.current;
        ws.send(JSON.stringify({ type: 'join_room', roomCode, displayName, role, token, playerId, hostSecret, reconnectSecret }));
      }

      // Start heartbeat
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 15000);
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as ServerMsg;
        handleMessage(msg);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);

      // If we have a pending join, try to reconnect (sends playerId so server
      // can restore identity within the grace period).
      if (pendingJoinRef.current) {
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 15000);
        reconnectAttemptsRef.current++;
        setStatus('reconnecting');
        reconnectTimeoutRef.current = setTimeout(() => connect(), delay);
      } else {
        setStatus('disconnected');
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [handleMessage]);

  const joinRoom = useCallback((
    roomCode: string,
    displayName: string,
    role: 'player' | 'spectator' = 'player',
    token?: string,
    playerId?: string,
    hostSecret?: string,
  ) => {
    // reconnectSecret starts undefined; it will be populated from the server's
    // room_joined response so that future reconnects include the correct proof.
    pendingJoinRef.current = { roomCode, displayName, role, token, playerId, hostSecret, reconnectSecret: undefined };
    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
      connect();
    } else if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'join_room', roomCode, displayName, role, token, playerId, hostSecret }));
    }
  }, [connect]);

  const leaveRoom = useCallback(() => {
    pendingJoinRef.current = null;
    sendRaw({ type: 'leave_room' });
    setRoom(null);
    setMyId(null);
    setRemotePlayers(new Map());
  }, [sendRaw]);

  const sendRocketState = useCallback((state: RocketState) => {
    sendRaw({ type: 'rocket_state', state });
  }, [sendRaw]);

  const setReady = useCallback((ready: boolean) => {
    sendRaw({ type: 'player_ready', ready });
  }, [sendRaw]);

  const startRound = useCallback(() => {
    sendRaw({ type: 'start_round' });
  }, [sendRaw]);

  const submitResult = useCallback((score: number, grade: string, crashed: boolean) => {
    sendRaw({ type: 'submit_result', score, grade, crashed });
  }, [sendRaw]);

  const disconnect = useCallback(() => {
    pendingJoinRef.current = null;
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
    setRoom(null);
    setMyId(null);
    setRemotePlayers(new Map());
  }, []);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      wsRef.current?.close();
    };
  }, []);

  return {
    status, room, myId, remotePlayers,
    joinRoom, leaveRoom, sendRocketState, setReady, startRound, submitResult, disconnect,
  };
}
