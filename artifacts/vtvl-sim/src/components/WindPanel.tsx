import { useState } from 'react';
import { WindOverride } from '../hooks/useSimulation';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

interface WindPanelProps {
  windOverride: WindOverride;
  setWindOverride: (next: Partial<WindOverride>) => void;
  windNow: number;
  disabled?: boolean;
}

export function WindPanel({
  windOverride,
  setWindOverride,
  windNow,
  disabled,
}: WindPanelProps) {
  const [open, setOpen] = useState(false);

  const direction =
    windOverride.speed > 0.05
      ? 'EAST'
      : windOverride.speed < -0.05
        ? 'WEST'
        : 'CALM';
  const speedLabel = `${windOverride.speed >= 0 ? '+' : ''}${windOverride.speed.toFixed(1)} m/s`;

  // The toggle pill is always visible; the controls expand below it.
  return (
    <div className="w-full md:w-60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded bg-black/70 border border-slate-800 hover:border-amber-500/40 backdrop-blur-sm text-left"
        aria-expanded={open}
      >
        <div className="flex flex-col">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
            Weather
          </span>
          <span className="text-xs font-mono text-slate-200">
            {direction} {speedLabel}
            {windOverride.gust > 0 && (
              <span className="text-slate-500"> ±{windOverride.gust.toFixed(1)}</span>
            )}
          </span>
        </div>
        <span
          className={`text-[10px] font-mono text-amber-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-2 p-4 rounded bg-black/80 border border-slate-800 backdrop-blur-sm flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
              <span className="text-slate-400">Wind speed</span>
              <span className="text-slate-200">{speedLabel}</span>
            </div>
            <Slider
              value={[windOverride.speed]}
              min={-25}
              max={25}
              step={0.5}
              onValueChange={([v]) => setWindOverride({ speed: v })}
              disabled={disabled}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-600">
              <span>← west</span>
              <button
                type="button"
                onClick={() => setWindOverride({ speed: 0 })}
                disabled={disabled}
                className="text-slate-500 hover:text-amber-400 disabled:opacity-50"
              >
                zero
              </button>
              <span>east →</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
              <span className="text-slate-400">Gust strength</span>
              <span className="text-slate-200">±{windOverride.gust.toFixed(1)} m/s</span>
            </div>
            <Slider
              value={[windOverride.gust]}
              min={0}
              max={15}
              step={0.5}
              onValueChange={([v]) => setWindOverride({ gust: v })}
              disabled={disabled}
              className="cursor-pointer"
            />
            <div className="text-[10px] font-mono text-slate-600 text-center">
              random gust amplitude
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-500 uppercase tracking-wider">Live wind</span>
            <span className="text-amber-400">{windNow.toFixed(2)} m/s</span>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWindOverride({ speed: -10, gust: 3 })}
              disabled={disabled}
              className="flex-1 h-7 px-2 text-[10px] font-mono uppercase tracking-wider border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Crosswind
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWindOverride({ speed: 0, gust: 6 })}
              disabled={disabled}
              className="flex-1 h-7 px-2 text-[10px] font-mono uppercase tracking-wider border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Gusty
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWindOverride({ speed: 0, gust: 0 })}
              disabled={disabled}
              className="flex-1 h-7 px-2 text-[10px] font-mono uppercase tracking-wider border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Calm
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
