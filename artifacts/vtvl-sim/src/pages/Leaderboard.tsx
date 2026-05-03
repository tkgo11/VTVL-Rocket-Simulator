import { useEffect, useState } from 'react';
import { api, LeaderboardEntry, PersonalBestEntry } from '../lib/api';
import { usePlayer } from '../contexts/PlayerContext';
import { Button } from '../components/ui/button';
import { GRADE_COLORS, Grade } from '../lib/scoring';
import { MISSIONS } from '../lib/missions';

interface Props {
  onBack: () => void;
}

export default function Leaderboard({ onBack }: Props) {
  const { player } = usePlayer();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [personalBest, setPersonalBest] = useState<PersonalBestEntry | null>(null);
  const [missionFilter, setMissionFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    // Pass the guest display name when no token is present so the server can
    // resolve the guest's personal-best row alongside the top-N.
    const guestName = !player?.token && player?.type === 'guest' ? player.displayName : undefined;
    api.leaderboard
      .get(missionFilter || undefined, 50, player?.token, guestName)
      .then((res) => {
        setEntries(res.entries);
        setPersonalBest(res.personalBest);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [missionFilter, player?.token, player?.type, player?.displayName]);

  // Only show the pinned "Your Best" row when the player's best entry is
  // outside the returned page (server returns rank=null in that case).
  const showPinnedBest = personalBest && personalBest.rank === null;

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="border-slate-700 text-slate-300 hover:text-amber-300 hover:border-amber-500/40 bg-transparent"
          >
            ← Back
          </Button>
          <h1 className="text-xl font-bold tracking-widest uppercase text-amber-400">
            Global Leaderboard
          </h1>
        </div>
        {player?.type === 'account' && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800/60 border border-slate-700">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-xs font-bold">
              {player.displayName[0]?.toUpperCase()}
            </div>
            <span className="text-xs font-mono text-slate-300">{player.displayName}</span>
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Mission filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setMissionFilter('')}
            className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-sm font-mono transition-colors ${
              missionFilter === '' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Missions
          </button>
          {MISSIONS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMissionFilter(m.id)}
              className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-sm font-mono transition-colors ${
                missionFilter === m.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-slate-500 text-sm text-center py-12">Loading…</div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center py-12">{error}</div>
        ) : entries.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-12">
            No entries yet. Be the first to land!
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 w-10">#</th>
                  <th className="text-left px-4 py-3">Pilot</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Mission</th>
                  <th className="text-right px-4 py-3">Score</th>
                  <th className="text-right px-4 py-3">Grade</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const isMe = player?.user?.id && entry.userId === player.user.id;
                  const mission = MISSIONS.find((m) => m.id === entry.missionId);
                  return (
                    <tr
                      key={entry.id}
                      className={`border-t border-slate-800 transition-colors ${
                        isMe ? 'bg-amber-500/10 border-amber-500/30' : 'hover:bg-slate-900/50'
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-white font-medium">
                        {entry.displayName}
                        {isMe && (
                          <span className="ml-2 text-[10px] text-amber-400 uppercase tracking-wider">You</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">
                        {mission?.name ?? entry.missionId}
                      </td>
                      <td className="px-4 py-3 text-right text-white">{entry.score}</td>
                      <td className={`px-4 py-3 text-right font-bold ${GRADE_COLORS[entry.grade as Grade] ?? 'text-slate-400'}`}>
                        {entry.grade}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 hidden md:table-cell">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}

                {/* "Your Best" pinned row — shown only when the player's best
                    entry is outside the returned top-N page. */}
                {showPinnedBest && personalBest && (
                  <>
                    <tr className="border-t border-slate-700">
                      <td colSpan={6} className="px-4 py-1 text-center text-[10px] font-mono uppercase tracking-widest text-slate-600">
                        · · ·
                      </td>
                    </tr>
                    <tr className="border-t border-amber-500/20 bg-amber-500/10">
                      <td className="px-4 py-3 text-slate-500">#{entries.length + 1}+</td>
                      <td className="px-4 py-3 text-white font-medium">
                        {personalBest.displayName}
                        <span className="ml-2 text-[10px] text-amber-400 uppercase tracking-wider">You</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">
                        {MISSIONS.find((m) => m.id === personalBest.missionId)?.name ?? personalBest.missionId}
                      </td>
                      <td className="px-4 py-3 text-right text-white">{personalBest.score}</td>
                      <td className={`px-4 py-3 text-right font-bold ${GRADE_COLORS[personalBest.grade as Grade] ?? 'text-slate-400'}`}>
                        {personalBest.grade}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 text-xs hidden md:table-cell">Outside top {entries.length}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
