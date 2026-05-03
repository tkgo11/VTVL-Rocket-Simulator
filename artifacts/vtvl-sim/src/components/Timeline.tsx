import { useEffect, useMemo, useRef } from 'react';
import { FlightRecording } from '../lib/recording';
import { Button } from './ui/button';

interface TimelineProps {
  recording: FlightRecording;
  time: number;
  playing: boolean;
  speed: number;
  onSeek: (t: number) => void;
  onTogglePlay: () => void;
  onSetSpeed: (s: number) => void;
  onExit: () => void;
  onSave?: () => void;
  isSaved?: boolean;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4];

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m.toString().padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

export function Timeline({
  recording,
  time,
  playing,
  speed,
  onSeek,
  onTogglePlay,
  onSetSpeed,
  onExit,
  onSave,
  isSaved,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Build a sparkline of altitude over time so the user can see arc shape.
  const altitudePath = useMemo(() => {
    const frames = recording.frames;
    if (frames.length === 0) return '';
    const w = 1000; // viewBox units
    const h = 100;
    const tMax = recording.duration || 1;
    let yMax = 0;
    for (const f of frames) {
      if (f.y > yMax) yMax = f.y;
    }
    yMax = Math.max(1, yMax);
    let d = '';
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const x = (f.t / tMax) * w;
      const y = h - (f.y / yMax) * (h - 4) - 2;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    }
    return d;
  }, [recording]);

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(u * recording.duration);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    handlePointer(e);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    handlePointer(e);
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Keyboard scrubbing: space toggles play, ←/→ jog by 0.5s.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSeek(Math.max(0, time - 0.5));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSeek(Math.min(recording.duration, time + 0.5));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTogglePlay, onSeek, onExit, time, recording.duration]);

  const progress = recording.duration > 0 ? time / recording.duration : 0;
  const outcomeColor =
    recording.outcome === 'landed' ? 'text-emerald-300' : 'text-red-400';

  return (
    <div className="absolute bottom-3 md:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100vw-1rem)] md:w-full max-w-3xl bg-black/85 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl px-3 py-3 md:px-5 md:py-4 flex flex-col gap-2 md:gap-3 z-30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400">
            Replay
          </div>
          <div className="text-xs font-mono text-slate-300">
            {recording.missionName}
          </div>
          <div className={`text-[10px] font-mono uppercase tracking-wider ${outcomeColor}`}>
            {recording.outcome}
            <span className="text-slate-500 ml-2">
              {recording.finalGrade} · {recording.finalScore}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="text-[10px] font-mono uppercase tracking-wider text-slate-500 hover:text-amber-400"
        >
          Exit (Esc)
        </button>
      </div>

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-20 bg-slate-900/60 border border-slate-800 rounded cursor-pointer overflow-hidden select-none touch-none"
      >
        <svg
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
        >
          {/* Altitude trace */}
          <path
            d={altitudePath}
            fill="none"
            stroke="#475569"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          {/* Filled progress region */}
          <path
            d={`${altitudePath} L1000,100 L0,100 Z`}
            fill="rgba(245,158,11,0.10)"
          />
        </svg>

        {/* Played-portion overlay (clip with width) */}
        <div
          className="absolute inset-y-0 left-0 bg-amber-500/15 border-r border-amber-400/60 pointer-events-none"
          style={{ width: `${progress * 100}%` }}
        />

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-400 pointer-events-none"
          style={{ left: `${progress * 100}%` }}
        >
          <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
        </div>

        {/* Time labels */}
        <div className="absolute top-1 left-2 text-[10px] font-mono text-slate-500 pointer-events-none">
          T+0
        </div>
        <div className="absolute top-1 right-2 text-[10px] font-mono text-slate-500 pointer-events-none">
          T+{recording.duration.toFixed(1)}s
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            onClick={onTogglePlay}
            size="sm"
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold tracking-wider uppercase px-4 h-8"
          >
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button
            type="button"
            onClick={() => onSeek(0)}
            variant="outline"
            size="sm"
            className="h-8 px-3 border-slate-700 text-slate-300 hover:bg-slate-800 font-mono text-[10px] uppercase tracking-wider"
          >
            Restart
          </Button>
          <div className="flex items-center gap-1 ml-2">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSetSpeed(s)}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  speed === s
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="text-[11px] font-mono text-slate-300">
            {formatTime(time)}
            <span className="text-slate-600"> / {formatTime(recording.duration)}</span>
          </div>
          {onSave && (
            <Button
              type="button"
              onClick={onSave}
              variant="outline"
              size="sm"
              disabled={isSaved}
              className="h-8 px-3 border-slate-700 text-slate-300 hover:bg-slate-800 font-mono text-[10px] uppercase tracking-wider disabled:opacity-50"
            >
              {isSaved ? 'Saved ✓' : 'Save Flight'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
