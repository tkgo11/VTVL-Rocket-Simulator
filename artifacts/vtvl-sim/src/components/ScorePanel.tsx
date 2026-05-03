import { MissionConfig } from '../lib/physics';
import { GRADE_COLORS, MAX_SCORE } from '../lib/scoring';
import { Button } from './ui/button';
import { RunResult } from '../hooks/useSimulation';

interface ScorePanelProps {
  result: RunResult;
  mission: MissionConfig;
  onReset: () => void;
  onBackToMissions: () => void;
  onReplay?: () => void;
  canReplay?: boolean;
  /** Called when the user explicitly opts to post their score to the global leaderboard. No-op if undefined (e.g. in replay mode). */
  onPostToLeaderboard?: () => void;
  /** True when this run has already been posted. Shows confirmation instead of the button. */
  leaderboardPosted?: boolean;
}

function ScoreBar({
  label,
  value,
  max,
  hint,
}: {
  label: string;
  value: number;
  max: number;
  hint: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs font-mono">
        <span className="text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-slate-300">
          {value}
          <span className="text-slate-600">/{max}</span>
        </span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] font-mono text-slate-500">{hint}</div>
    </div>
  );
}

export function ScorePanel({
  result,
  mission,
  onReset,
  onBackToMissions,
  onReplay,
  canReplay,
  onPostToLeaderboard,
  leaderboardPosted,
}: ScorePanelProps) {
  const { score, isNewBest, previousBest, best } = result;
  const crashed = score.crashed;
  const gradeColor = GRADE_COLORS[score.grade];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 pointer-events-none">
      <div className="bg-black/85 border border-slate-800 rounded-xl shadow-2xl pointer-events-auto w-full max-w-lg mx-4 overflow-hidden">
        <div className={`px-6 py-4 border-b ${crashed ? 'bg-red-950/40 border-red-900' : 'bg-emerald-950/30 border-emerald-900'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-slate-400">
                {crashed ? 'Mission Failure' : 'Vehicle Secure'}
              </div>
              <div className="text-lg font-bold text-white mt-0.5 tracking-wide">
                {mission.name}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-5xl font-bold font-mono ${gradeColor}`}>{score.grade}</div>
              <div className="text-xs font-mono text-slate-400 mt-1">
                {score.total} <span className="text-slate-600">/ {MAX_SCORE}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {!crashed ? (
            <div className="grid grid-cols-1 gap-3">
              <ScoreBar
                label="Touchdown Velocity"
                value={score.breakdown.velocity}
                max={300}
                hint={`${score.metrics.touchdownSpeed.toFixed(2)} m/s combined`}
              />
              <ScoreBar
                label="Pad Accuracy"
                value={score.breakdown.accuracy}
                max={300}
                hint={`${score.metrics.padDeviation.toFixed(2)} m from target (radius ${mission.padRadius} m)`}
              />
              <ScoreBar
                label="Fuel Reserve"
                value={score.breakdown.fuel}
                max={200}
                hint={`${Math.round(score.metrics.fuelRemaining).toLocaleString()} kg (${(score.metrics.fuelFraction * 100).toFixed(1)}% of starting load)`}
              />
              <ScoreBar
                label="Final Tilt"
                value={score.breakdown.tilt}
                max={200}
                hint={`${score.metrics.tiltDeg.toFixed(2)}° from vertical`}
              />
            </div>
          ) : (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 text-sm font-mono text-red-200/80 space-y-1.5">
              <div className="flex justify-between">
                <span>Impact Velocity</span>
                <span className="text-red-300">{score.metrics.touchdownSpeed.toFixed(1)} m/s</span>
              </div>
              <div className="flex justify-between">
                <span>Impact Tilt</span>
                <span className="text-red-300">{score.metrics.tiltDeg.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span>Pad Deviation</span>
                <span className="text-red-300">{score.metrics.padDeviation.toFixed(1)} m</span>
              </div>
            </div>
          )}

          <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs font-mono">
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500 uppercase tracking-wider">Personal Best</span>
              {best ? (
                <span className="text-slate-200">
                  <span className={GRADE_COLORS[best.grade]}>{best.grade}</span>{' '}
                  <span className="text-slate-300">{best.score}</span>
                  {previousBest && !isNewBest && (
                    <span className="text-slate-600 ml-2">prev {previousBest.score}</span>
                  )}
                </span>
              ) : (
                <span className="text-slate-600">Land the vehicle to set a record</span>
              )}
            </div>
            {isNewBest && !crashed && (
              <div className="px-3 py-1.5 bg-amber-500/20 border border-amber-500/50 rounded-md text-amber-300 uppercase tracking-wider text-[10px] font-bold">
                New Personal Best
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-3">
              <Button
                onClick={onReset}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold tracking-wider uppercase"
              >
                Retry (R)
              </Button>
              <Button
                onClick={onBackToMissions}
                variant="outline"
                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 font-bold tracking-wider uppercase"
              >
                Missions (M)
              </Button>
            </div>
            {onReplay && (
              <Button
                onClick={onReplay}
                disabled={!canReplay}
                variant="outline"
                className="w-full border-amber-700/60 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 font-bold tracking-wider uppercase disabled:opacity-50"
              >
                Review Flight (V)
              </Button>
            )}
            {onPostToLeaderboard && (
              leaderboardPosted ? (
                <div className="w-full text-center text-xs font-mono text-emerald-400 py-1 tracking-wider uppercase">
                  ✓ Posted to Leaderboard
                </div>
              ) : (
                <Button
                  onClick={onPostToLeaderboard}
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white font-bold tracking-wider uppercase text-xs"
                >
                  Post to Leaderboard
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
