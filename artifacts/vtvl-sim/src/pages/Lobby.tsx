import { useEffect, useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { useMultiplayerSocket, RoundResult } from '../hooks/useMultiplayerSocket';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { Button } from '../components/ui/button';
import { RoomInfo } from '../lib/api';
import { MISSIONS, getMission } from '../lib/missions';
import MultiplayerSimulator from './MultiplayerSimulator';
import { GRADE_COLORS, Grade } from '../lib/scoring';

interface Props {
  room: RoomInfo;
  role: 'player' | 'spectator';
  /** The player ID the server assigned when creating this room (guest host continuity). */
  myPlayerId?: string;
  /** Server-issued secret from POST /rooms — required to claim host authority over WS. */
  hostSecret?: string;
  onLeave: () => void;
}

export default function Lobby({ room: initialRoom, role, myPlayerId, hostSecret, onLeave }: Props) {
  const { player } = usePlayer();
  const [roundResults, setRoundResults] = useState<RoundResult[] | null>(null);
  const [inGame, setInGame] = useState(false);
  const [gameMissionId, setGameMissionId] = useState(initialRoom.missionId);
  const [gameSeed, setGameSeed] = useState(0);
  const [midRoundEntered, setMidRoundEntered] = useState(false);

  const displayName = player?.displayName ?? `Pilot-${Math.random().toString(36).slice(-4)}`;

  const mp = useMultiplayerSocket({
    onRoundStarting: (missionId, seed) => {
      setGameMissionId(missionId);
      setGameSeed(seed);
      setRoundResults(null);
      setInGame(true);
    },
    onRoundEnded: (results) => {
      setRoundResults(results);
      setInGame(false);
    },
    onError: (code, message) => {
      console.warn('[MP]', code, message);
    },
  });

  useEffect(() => {
    // Pass myPlayerId + hostSecret so the server can verify host authority (guest host fix).
    // Authentication via the HttpOnly cookie is handled automatically by the browser.
    mp.joinRoom(initialRoom.code, displayName, role, myPlayerId, hostSecret);
    return () => { mp.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-enter the simulator when joining a room that already has a round in progress
  // (e.g. a spectator deep-linking into a live room mid-round).
  useEffect(() => {
    if (midRoundEntered || inGame) return;
    const r = mp.room;
    if (r?.status === 'in_progress' && r.currentMissionId && r.currentSeed != null) {
      setMidRoundEntered(true);
      setGameMissionId(r.currentMissionId);
      setGameSeed(r.currentSeed);
      setInGame(true);
    }
  }, [mp.room, inGame, midRoundEntered]);

  const activeRoom = mp.room ?? initialRoom;
  const mission = getMission(activeRoom.missionId);
  const myId = mp.myId;
  const isHost = myId === activeRoom.hostId;

  const players = Array.from(mp.remotePlayers.values());
  const myPlayer = players.find((p) => p.id === myId);
  const allPlayersReady = players.filter((p) => p.role === 'player').every((p) => p.ready);

  const handleLeave = () => {
    mp.leaveRoom();
    mp.disconnect();
    onLeave();
  };

  if (inGame) {
    return (
      <MultiplayerSimulator
        missionId={gameMissionId}
        seed={gameSeed}
        mp={mp}
        myId={myId}
        role={role}
        displayName={displayName}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline" size="sm" onClick={handleLeave}
            className="border-slate-700 text-slate-300 hover:text-red-400 hover:border-red-500/40 bg-transparent"
          >
            Leave
          </Button>
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400">Room</span>
            {' '}
            <span className="text-amber-400 font-bold tracking-widest">{activeRoom.code}</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${
            activeRoom.type === 'coop'
              ? 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10'
              : 'text-red-300 border-red-500/40 bg-red-500/10'
          }`}>
            {activeRoom.type === 'coop' ? 'Co-op' : 'Versus'}
          </span>
        </div>
        <ConnectionIndicator status={mp.status} />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 w-full flex-1">
        {/* Mission info */}
        <div className="mb-6 p-4 bg-slate-900 rounded-lg border border-slate-800">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Mission</div>
          <div className="text-lg font-bold text-white">{mission.name}</div>
          <div className="text-sm text-slate-400">{mission.description}</div>
        </div>

        {/* Players */}
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">
            Players ({players.filter((p) => p.role === 'player').length})
          </div>
          <div className="space-y-2">
            {players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                  p.id === myId
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-slate-800 bg-slate-900/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${p.ready ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span className="text-sm text-white">
                    {p.displayName}
                    {p.id === myId && <span className="ml-2 text-amber-400 text-xs">(You)</span>}
                    {p.id === activeRoom.hostId && <span className="ml-2 text-slate-500 text-xs">Host</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {p.role === 'spectator' && (
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Spectator</span>
                  )}
                  {p.role === 'player' && (
                    <span className={`text-xs uppercase tracking-wider ${p.ready ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {p.ready ? 'Ready' : 'Not ready'}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {players.length === 0 && (
              <div className="text-slate-600 text-sm py-4 text-center">
                Waiting for players to join…
              </div>
            )}
          </div>
        </div>

        {/* Share links */}
        <div className="mb-6 p-4 bg-slate-900 rounded-lg border border-slate-800 space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Player Invite Link</div>
            <div className="flex gap-2 items-center">
              <code className="text-xs text-slate-300 flex-1 truncate">
                {window.location.origin}{window.location.pathname}?room={activeRoom.code}
              </code>
              <Button
                size="sm" variant="outline"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${activeRoom.code}`)}
                className="border-slate-700 text-slate-300 hover:text-amber-300 shrink-0 text-xs"
              >
                Copy
              </Button>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Spectator Link</div>
            <div className="flex gap-2 items-center">
              <code className="text-xs text-slate-500 flex-1 truncate">
                {window.location.origin}{window.location.pathname}?spectate={activeRoom.code}
              </code>
              <Button
                size="sm" variant="outline"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?spectate=${activeRoom.code}`)}
                className="border-slate-700 text-slate-400 hover:text-slate-200 shrink-0 text-xs"
              >
                Copy
              </Button>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          {role === 'player' && (
            <Button
              onClick={() => {
                const ready = !myPlayer?.ready;
                mp.setReady(ready);
              }}
              variant="outline"
              className={`flex-1 font-bold uppercase tracking-wider border ${
                myPlayer?.ready
                  ? 'border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10'
                  : 'border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
              }`}
            >
              {myPlayer?.ready ? '✓ Ready' : 'Ready Up'}
            </Button>
          )}
          {isHost && (
            <Button
              onClick={() => mp.startRound()}
              disabled={!allPlayersReady && players.filter((p) => p.role === 'player').length > 1}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold uppercase tracking-wider disabled:opacity-40"
            >
              Start Round
            </Button>
          )}
          {!isHost && role === 'player' && (
            <p className="flex-1 text-center text-slate-500 text-xs self-center">
              Waiting for host to start…
            </p>
          )}
        </div>
      </div>

      {/* Round results overlay */}
      {roundResults && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-amber-400 tracking-widest uppercase mb-6 text-center">
              Round Results
            </h2>
            <div className="space-y-3 mb-8">
              {roundResults.map((r, idx) => (
                <div
                  key={r.playerId}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                    idx === 0 && !r.crashed ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm w-5">{idx + 1}.</span>
                    <span className="text-white font-medium">
                      {r.displayName}
                      {r.playerId === myId && <span className="ml-2 text-amber-400 text-xs">(You)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.crashed ? (
                      <span className="text-red-400 text-sm">CRASHED</span>
                    ) : (
                      <>
                        <span className={`font-bold ${GRADE_COLORS[r.grade as Grade] ?? 'text-slate-400'}`}>{r.grade}</span>
                        <span className="text-white">{r.score}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              {isHost && (
                <Button
                  onClick={() => { setRoundResults(null); mp.startRound(); }}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold uppercase tracking-wider"
                >
                  Play Again
                </Button>
              )}
              <Button
                onClick={() => setRoundResults(null)}
                variant="outline"
                className="flex-1 border-slate-700 text-slate-300 hover:text-white"
              >
                Back to Lobby
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
