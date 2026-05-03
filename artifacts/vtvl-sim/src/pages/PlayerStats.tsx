import { useEffect, useState } from 'react';
import { api, PlayerStats as PlayerStatsData } from '../lib/api';
import { usePlayer } from '../contexts/PlayerContext';
import { Button } from '../components/ui/button';
import { GRADE_COLORS, Grade } from '../lib/scoring';

interface Props {
  onBack: () => void;
}

export default function PlayerStats({ onBack }: Props) {
  const { player, logout } = usePlayer();
  const [stats, setStats] = useState<PlayerStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!player?.user?.id) return;
    setLoading(true);
    api.players
      .stats(player.user.id, player.token)
      .then(setStats)
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
          variant="outline" size="sm" onClick={logout}
          className="border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/40 bg-transparent"
        >
          Sign Out
        </Button>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
