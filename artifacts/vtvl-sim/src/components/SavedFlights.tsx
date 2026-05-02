import { useEffect, useState } from 'react';
import {
  FlightRecording,
  deleteRecording,
  getSavedRecordings,
} from '../lib/recording';
import { GRADE_COLORS } from '../lib/scoring';
import { Button } from './ui/button';

interface SavedFlightsProps {
  open: boolean;
  onClose: () => void;
  onLoad: (recording: FlightRecording) => void;
  // Optional filter - when set, only show recordings for this mission.
  missionId?: string;
  // Bumped when caller wants the panel to refresh its list (e.g. after a save).
  refreshKey?: number;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return date.toLocaleDateString();
}

export function SavedFlights({
  open,
  onClose,
  onLoad,
  missionId,
  refreshKey,
}: SavedFlightsProps) {
  const [recordings, setRecordings] = useState<FlightRecording[]>([]);
  const [filterAll, setFilterAll] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRecordings(getSavedRecordings());
  }, [open, refreshKey]);

  if (!open) return null;

  const visible = recordings.filter((r) =>
    filterAll || !missionId ? true : r.missionId === missionId,
  );

  const handleDelete = (id: string) => {
    setRecordings(deleteRecording(id));
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-black/90 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-amber-400">
              Flight Archive
            </div>
            <div className="text-lg font-bold text-white tracking-wide">
              Saved Recordings
            </div>
          </div>
          <div className="flex items-center gap-2">
            {missionId && (
              <button
                type="button"
                onClick={() => setFilterAll((v) => !v)}
                className="text-[10px] font-mono uppercase tracking-wider text-slate-500 hover:text-amber-400"
              >
                {filterAll ? 'this mission only' : 'show all missions'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl leading-none px-2"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {visible.length === 0 ? (
            <div className="text-center text-sm font-mono text-slate-500 py-12">
              No saved flights yet.
              <div className="text-[11px] mt-2 text-slate-600">
                Complete a flight, then click <span className="text-amber-400">Save Flight</span>{' '}
                in the replay timeline.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {visible.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-slate-900/40 border border-slate-800 hover:border-amber-500/40 rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">
                        {rec.missionName}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                          rec.outcome === 'landed'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : 'bg-red-500/15 text-red-300 border-red-500/40'
                        }`}
                      >
                        {rec.outcome}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{formatRelative(rec.date)}</span>
                      <span>{rec.duration.toFixed(1)}s</span>
                      <span>
                        wind {rec.windSpeed >= 0 ? '+' : ''}
                        {rec.windSpeed.toFixed(1)}
                        {rec.windGust > 0 && `±${rec.windGust.toFixed(1)}`} m/s
                      </span>
                      <span>
                        <span className={GRADE_COLORS[rec.finalGrade]}>{rec.finalGrade}</span>{' '}
                        <span className="text-slate-300">{rec.finalScore}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      onClick={() => onLoad(rec)}
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-500 text-white font-mono text-[10px] uppercase tracking-wider h-8 px-3"
                    >
                      Replay
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rec.id)}
                      className="text-slate-500 hover:text-red-400 text-[10px] font-mono uppercase tracking-wider px-2"
                    >
                      delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
