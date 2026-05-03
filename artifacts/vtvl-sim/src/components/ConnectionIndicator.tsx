import { ConnectionStatus } from '../hooks/useMultiplayerSocket';

interface Props {
  status: ConnectionStatus;
}

const CONFIG: Record<ConnectionStatus, { color: string; label: string; pulse?: boolean }> = {
  connected:    { color: 'bg-emerald-400', label: 'Online' },
  connecting:   { color: 'bg-amber-400',   label: 'Connecting', pulse: true },
  reconnecting: { color: 'bg-amber-400',   label: 'Reconnecting', pulse: true },
  disconnected: { color: 'bg-red-500',     label: 'Offline' },
};

export function ConnectionIndicator({ status }: Props) {
  const cfg = CONFIG[status];
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900/80 border border-slate-700/60 backdrop-blur-sm">
      <span
        className={`w-2 h-2 rounded-full ${cfg.color} ${cfg.pulse ? 'animate-pulse' : ''}`}
      />
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300">
        {cfg.label}
      </span>
    </div>
  );
}
