import { useEffect, useState } from 'react';
import { MissionConfig } from '../lib/physics';
import { MISSIONS } from '../lib/missions';
import { getBest, LeaderboardEntry } from '../lib/leaderboard';
import { GRADE_COLORS } from '../lib/scoring';
import { Button } from './ui/button';

interface MissionSelectProps {
  onSelect: (mission: MissionConfig) => void;
}

const DIFFICULTY_STYLE: Record<MissionConfig['difficulty'], string> = {
  easy: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  hard: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  extreme: 'bg-red-500/20 text-red-300 border-red-500/40',
};

function MissionStat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="font-mono text-sm text-slate-200">
        {value}
        {unit && <span className="text-slate-500 ml-0.5 text-xs">{unit}</span>}
      </span>
    </div>
  );
}

function BestBadge({ best }: { best: LeaderboardEntry | null }) {
  if (!best) {
    return (
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-600">
        No record
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Best</span>
      <span className={`font-mono font-bold text-sm ${GRADE_COLORS[best.grade]}`}>
        {best.grade}
      </span>
      <span className="font-mono text-xs text-slate-300">{best.score}</span>
    </div>
  );
}

export function MissionSelect({ onSelect }: MissionSelectProps) {
  const [bests, setBests] = useState<Record<string, LeaderboardEntry | null>>({});

  useEffect(() => {
    const map: Record<string, LeaderboardEntry | null> = {};
    for (const m of MISSIONS) {
      map[m.id] = getBest(m.id);
    }
    setBests(map);
  }, []);

  return (
    <div className="relative w-full min-h-screen overflow-y-auto bg-gradient-to-b from-[#020617] via-[#050a18] to-[#0b1220] text-slate-200">
      <div className="absolute inset-0 pointer-events-none opacity-30 [background-image:radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.18),transparent_60%),radial-gradient(circle_at_75%_80%,rgba(59,130,246,0.15),transparent_55%)]" />

      <div className="relative max-w-6xl mx-auto px-6 py-12">
        <header className="mb-10 text-center">
          <div className="text-[10px] font-mono tracking-[0.4em] text-amber-500/80 mb-3">
            VTVL FLIGHT OPS // MISSION BRIEFING
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
            Select a Mission
          </h1>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto">
            Six flight profiles across three worlds. Each landing is graded on
            touchdown velocity, pad accuracy, fuel efficiency, and final tilt.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MISSIONS.map((m) => {
            const best = bests[m.id] ?? null;
            const offset = m.targetPadX !== 0;
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m)}
                className="group text-left bg-black/50 border border-slate-800 hover:border-amber-500/60 hover:bg-black/70 rounded-xl p-5 shadow-xl transition-all backdrop-blur-sm focus:outline-none focus:border-amber-500"
              >
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-white tracking-wide">{m.name}</h2>
                    <p className="text-sm text-slate-400 mt-1 leading-snug">{m.description}</p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${DIFFICULTY_STYLE[m.difficulty]}`}
                  >
                    {m.difficulty}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-800/80 pt-3">
                  <MissionStat label="Altitude" value={m.startAltitude} unit="m" />
                  <MissionStat label="Fuel" value={m.fuel.toLocaleString()} unit="kg" />
                  <MissionStat label="Gravity" value={m.gravity.toFixed(2)} unit="m/s²" />
                  <MissionStat
                    label="Wind"
                    value={m.wind === 0 && m.windGust === 0 ? 'Calm' : `${m.wind > 0 ? '+' : ''}${m.wind}${m.windGust > 0 ? `±${m.windGust}` : ''}`}
                    unit={m.wind === 0 && m.windGust === 0 ? '' : 'm/s'}
                  />
                  <MissionStat
                    label="Pad Target"
                    value={offset ? `${m.targetPadX > 0 ? '+' : ''}${m.targetPadX}` : 'Origin'}
                    unit={offset ? 'm' : ''}
                  />
                  <MissionStat
                    label="Pad Radius"
                    value={m.padRadius}
                    unit="m"
                  />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                  <BestBadge best={best} />
                  <span className="text-amber-400/80 text-xs font-mono uppercase tracking-wider group-hover:text-amber-300">
                    Brief →
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <footer className="mt-10 text-center text-xs font-mono text-slate-600">
          Best scores are stored locally on this device.
        </footer>
      </div>
    </div>
  );
}
