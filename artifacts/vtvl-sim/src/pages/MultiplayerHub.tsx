import { useState } from 'react';
import { api, RoomInfo, CreateRoomResponse } from '../lib/api';
import { usePlayer } from '../contexts/PlayerContext';
import { MISSIONS } from '../lib/missions';
import { Button } from '../components/ui/button';

type RoomType = 'coop' | 'versus';
type View = 'landing' | 'create' | 'join' | 'spectate';

interface Props {
  onBack: () => void;
  /** myPlayerId is the hostId; hostSecret is the server-issued secret — both returned from POST /rooms. */
  onJoinRoom: (room: RoomInfo, role: 'player' | 'spectator', myPlayerId?: string, hostSecret?: string) => void;
  /** When provided, open directly to this view instead of the landing page. */
  initialView?: View;
}

export default function MultiplayerHub({ onBack, onJoinRoom, initialView }: Props) {
  const { player } = usePlayer();
  const [view, setView] = useState<View>(initialView ?? 'landing');
  const [roomType, setRoomType] = useState<RoomType>('coop');
  const [missionId, setMissionId] = useState(MISSIONS[0].id);
  const [joinCode, setJoinCode] = useState('');
  const [guestName, setGuestName] = useState(player?.displayName ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdRoom, setCreatedRoom] = useState<CreateRoomResponse | null>(null);

  // For account users, displayName is their stored username (field is hidden).
  // For guests the editable local state is authoritative — typed edits take
  // precedence over the previously stored guest name in context.
  const displayName = player?.type === 'account' ? player.displayName : (guestName || player?.displayName || '');

  const handleCreate = async () => {
    if (!displayName.trim()) { setError('Enter a pilot name first'); return; }
    setLoading(true);
    setError('');
    try {
      const room = await api.rooms.create(roomType, missionId, displayName);
      setCreatedRoom(room);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (code: string, role: 'player' | 'spectator' = 'player') => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Enter a room code'); return; }
    if (!displayName.trim() && role === 'player') { setError('Enter a pilot name first'); return; }
    setLoading(true);
    setError('');
    try {
      const room = await api.rooms.get(trimmed);
      onJoinRoom(room, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Room not found');
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = createdRoom
    ? `${window.location.origin}${window.location.pathname}?room=${createdRoom.code}`
    : null;
  const spectateUrl = createdRoom
    ? `${window.location.origin}${window.location.pathname}?spectate=${createdRoom.code}`
    : null;

  const goCreate = (type: RoomType) => {
    setRoomType(type);
    setCreatedRoom(null);
    setError('');
    setView('create');
  };

  const NameField = () =>
    !player || player.type === 'guest' ? (
      <div className="mb-6">
        <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Pilot Name</label>
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value.slice(0, 24))}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
          placeholder="Enter a display name…"
          maxLength={24}
        />
        <p className="text-slate-600 text-xs mt-1">Sign in to save your name and stats permanently.</p>
      </div>
    ) : (
      <div className="mb-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-sm">
          {player.displayName[0]?.toUpperCase()}
        </div>
        <div>
          <div className="text-sm text-white font-medium">{player.displayName}</div>
          <div className="text-xs text-slate-500">Signed in</div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Button
          variant="outline" size="sm"
          onClick={view === 'landing' ? onBack : () => { setView('landing'); setError(''); setCreatedRoom(null); }}
          className="border-slate-700 text-slate-300 hover:text-amber-300 hover:border-amber-500/40 bg-transparent"
        >
          ← {view === 'landing' ? 'Back' : 'Menu'}
        </Button>
        <h1 className="text-xl font-bold tracking-widest uppercase text-amber-400">Multiplayer</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 w-full flex-1">

        {/* ── LANDING ── */}
        {view === 'landing' && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm mb-8">Choose a mode to get started.</p>
            {/* Co-op */}
            <button
              onClick={() => goCreate('coop')}
              className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl px-6 py-5 transition-colors group"
            >
              <div className="text-lg font-bold text-amber-400 group-hover:text-amber-300 mb-1">Co-op</div>
              <div className="text-sm text-slate-400">Fly together in the same world. All pilots share identical wind and gravity.</div>
            </button>
            {/* Versus */}
            <button
              onClick={() => goCreate('versus')}
              className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl px-6 py-5 transition-colors group"
            >
              <div className="text-lg font-bold text-amber-400 group-hover:text-amber-300 mb-1">Versus</div>
              <div className="text-sm text-slate-400">Same mission, same seed. Everyone competes head-to-head for the best landing.</div>
            </button>
            {/* Join existing */}
            <button
              onClick={() => { setError(''); setView('join'); }}
              className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl px-6 py-5 transition-colors group"
            >
              <div className="text-lg font-bold text-slate-200 group-hover:text-white mb-1">Join Room</div>
              <div className="text-sm text-slate-400">Enter a 6-character code to join a friend's room as a player.</div>
            </button>
            {/* Spectate */}
            <button
              onClick={() => { setError(''); setView('spectate'); }}
              className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl px-6 py-5 transition-colors group"
            >
              <div className="text-lg font-bold text-slate-200 group-hover:text-white mb-1">Spectate</div>
              <div className="text-sm text-slate-400">Watch a live room in real-time with no controls. No account required.</div>
            </button>
          </div>
        )}

        {/* ── CREATE ── */}
        {view === 'create' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-bold text-amber-400">
                {roomType === 'coop' ? 'Co-op' : 'Versus'}
              </span>
              <span className="text-slate-500 text-sm">— Create Room</span>
            </div>
            <p className="text-slate-400 text-sm">
              {roomType === 'coop'
                ? 'Fly together. Work together to stick the landing.'
                : 'Same mission, same seed. May the best pilot win.'}
            </p>

            <NameField />

            {/* Mission selector */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Mission</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MISSIONS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMissionId(m.id)}
                    className={`text-left px-4 py-3 rounded-md border text-sm transition-colors ${
                      missionId === m.id
                        ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                        : 'border-slate-800 hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 capitalize">{m.difficulty}</div>
                  </button>
                ))}
              </div>
            </div>

            {!createdRoom ? (
              <Button
                onClick={handleCreate}
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold uppercase tracking-wider"
              >
                {loading ? 'Creating…' : `Create ${roomType === 'coop' ? 'Co-op' : 'Versus'} Room`}
              </Button>
            ) : (
              <div className="bg-slate-900 border border-amber-500/30 rounded-lg p-5 space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Room Code</div>
                  <div className="text-3xl font-bold tracking-[0.3em] text-amber-400">{createdRoom.code}</div>
                </div>
                {shareUrl && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Player Link</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded flex-1 truncate">{shareUrl}</code>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => navigator.clipboard.writeText(shareUrl)}
                        className="border-slate-700 text-slate-300 hover:text-amber-300 shrink-0"
                      >Copy</Button>
                    </div>
                  </div>
                )}
                {spectateUrl && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Spectator Link</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded flex-1 truncate">{spectateUrl}</code>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => navigator.clipboard.writeText(spectateUrl)}
                        className="border-slate-700 text-slate-300 hover:text-amber-300 shrink-0"
                      >Copy</Button>
                    </div>
                  </div>
                )}
                <Button
                  onClick={() => onJoinRoom(createdRoom, 'player', createdRoom.hostId, createdRoom.hostSecret)}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold uppercase tracking-wider"
                >
                  Enter Room →
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── JOIN ── */}
        {view === 'join' && (
          <div className="space-y-6">
            <div className="text-lg font-bold text-slate-200 mb-2">Join a Room</div>
            <NameField />
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Room Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="XXXXXX"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 uppercase tracking-widest font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin(joinCode)}
                />
                <Button
                  onClick={() => handleJoin(joinCode)}
                  disabled={loading}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold"
                >
                  {loading ? '…' : 'Join'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── SPECTATE ── */}
        {view === 'spectate' && (
          <div className="space-y-6">
            <div className="text-lg font-bold text-slate-200 mb-2">Spectate a Room</div>
            <p className="text-slate-400 text-sm">Watch live without participating. No controls, no account required.</p>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Room Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="XXXXXX"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 uppercase tracking-widest font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin(joinCode, 'spectator')}
                />
                <Button
                  onClick={() => handleJoin(joinCode, 'spectator')}
                  disabled={loading}
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:text-amber-300 hover:border-amber-500/40"
                >
                  {loading ? '…' : 'Watch'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm font-mono mt-6">{error}</p>}
      </div>
    </div>
  );
}
