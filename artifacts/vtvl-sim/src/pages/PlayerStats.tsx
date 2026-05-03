import { useEffect, useState } from 'react';
import { api, PlayerStats as PlayerStatsData, PlayerRun } from '../lib/api';
import { usePlayer } from '../contexts/PlayerContext';
import { Button } from '../components/ui/button';
import { GRADE_COLORS, Grade } from '../lib/scoring';
import { MISSIONS } from '../lib/missions';

interface Props {
  onBack: () => void;
}

export default function PlayerStats({ onBack }: Props) {
  const { player, logout } = usePlayer();
  const [stats, setStats] = useState<PlayerStatsData | null>(null);
  const [runs, setRuns] = useState<PlayerRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!player?.user?.id) return;
    setLoading(true);
    setError('');
    Promise.all([
      api.players.stats(player.user.id),
      api.players.runs(player.user.id, 25),
    ])
      .then(([s, r]) => {
        setStats(s);
        setRuns(r.runs);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [player]);

  if (!player || player.type !== 'account') {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center gap-4">
        <p className="text-slate-400">Sign in to view your stats.</p>
        <Button onClick={onBack} variant="outline" className="border-slate-700 text-slate-300">
          ← Back
        </Button>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    onBack();
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline" size="sm" onClick={onBack}
            className="border-slate-700 text-slate-300 hover:text-amber-300 hover:border-amber-500/40 bg-transparent"
          >
            ← Back
          </Button>
          <h1 className="text-xl font-bold tracking-widest uppercase text-amber-400">
            Pilot Profile
          </h1>
        </div>
        <Button
          variant="outline" size="sm" onClick={handleLogout}
          className="border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/40 bg-transparent"
        >
          Sign Out
        </Button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-2xl">
            {player.displayName[0]?.toUpperCase()}
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{player.displayName}</div>
            <div className="text-sm text-slate-500">{player.user?.email}</div>
          </div>
        </div>

        {loading ? (
          <div className="text-slate-500 text-sm text-center py-12">Loading…</div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center py-12">{error}</div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
              <StatCard label="Total Flights" value={String(stats.totalFlights)} />
              <StatCard label="Success Rate" value={`${Math.round(stats.successRate * 100)}%`} />
              <StatCard
                label="Best Score"
                value={stats.bestScore !== null ? String(stats.bestScore) : '—'}
              />
              <StatCard
                label="Best Grade"
                value={stats.bestGrade ?? '—'}
                className={stats.bestGrade ? (GRADE_COLORS[stats.bestGrade as Grade] ?? '') : 'text-slate-400'}
              />
            </div>

            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm uppercase tracking-widest text-slate-400">Recent Runs</h2>
              <span className="text-xs text-slate-600">{runs.length} shown</span>
            </div>

            {runs.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-8 border border-slate-800 rounded-lg">
                No flights recorded yet. Fly a mission to fill out your log.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Mission</th>
                      <th className="text-right px-4 py-3">Score</th>
                      <th className="text-right px-4 py-3">Grade</th>
                      <th className="text-right px-4 py-3 hidden sm:table-cell">Result</th>
                      <th className="text-right px-4 py-3 hidden md:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => {
                      const mission = MISSIONS.find((m) => m.id === r.missionId);
                      return (
                        <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                          <td className="px-4 py-3 text-slate-200">{mission?.name ?? r.missionId}</td>
                          <td className="px-4 py-3 text-right text-white">{r.score}</td>
                          <td className={`px-4 py-3 text-right font-bold ${GRADE_COLORS[r.grade as Grade] ?? 'text-slate-400'}`}>
                            {r.grade}
                          </td>
                          <td className="px-4 py-3 text-right hidden sm:table-cell">
                            {r.crashed ? (
                              <span className="text-red-400 text-xs uppercase tracking-wider">Crashed</span>
                            ) : (
                              <span className="text-emerald-400 text-xs uppercase tracking-wider">Landed</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500 hidden md:table-cell">
                            {new Date(r.createdAt).toLocaleString(undefined, {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, className = 'text-amber-400' }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">{label}</div>
      <div className={`text-2xl font-bold ${className}`}>{value}</div>
    </div>
  );
}
