import { Controls } from '../lib/physics';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

interface ControlPanelProps {
  controls: Controls;
  setControls: (controls: Partial<Controls>) => void;
  launch: () => void;
  reset: () => void;
  autopilotEnabled: boolean;
  setAutopilotEnabled: (enabled: boolean) => void;
  status: string;
  launchLabel?: string;
  onBackToMissions?: () => void;
  maxGimbalDeg?: number;
}

/**
 * Desktop control surface: throttle/gimbal sliders + action buttons.
 * Keyboard handlers live in `useKeyboardControls` so they keep working when
 * the touch surface is mounted instead.
 */
export function ControlPanel({
  controls,
  setControls,
  launch,
  reset,
  autopilotEnabled,
  setAutopilotEnabled,
  status,
  launchLabel = 'Launch',
  onBackToMissions,
  maxGimbalDeg = 15,
}: ControlPanelProps) {
  const ended = status === 'landed' || status === 'crashed';
  const sliderDisabled = autopilotEnabled || ended;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-black/80 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-2xl flex flex-col gap-6">

      <div className="flex items-center justify-between gap-8">
        {/* Throttle Control */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400">
            <span>THROTTLE</span>
            <span>{Math.round(controls.throttle * 100)}%</span>
          </div>
          <Slider
            value={[controls.throttle]}
            max={1}
            step={0.01}
            onValueChange={([val]) => !autopilotEnabled && setControls({ throttle: val })}
            disabled={sliderDisabled}
            className="cursor-pointer"
          />
          <div className="text-[10px] text-slate-500 font-mono mt-1 text-center">W/S or ↑/↓ to adjust, SPACE for max</div>
        </div>

        {/* Gimbal Control */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400">
            <span>GIMBAL</span>
            <span>{(controls.gimbal * maxGimbalDeg).toFixed(1)}°</span>
          </div>
          <Slider
            value={[controls.gimbal]}
            min={-1}
            max={1}
            step={0.05}
            onValueChange={([val]) => !autopilotEnabled && setControls({ gimbal: val })}
            disabled={sliderDisabled}
            className="cursor-pointer"
          />
          <div className="text-[10px] text-slate-500 font-mono mt-1 text-center">A/D or ←/→ to steer</div>
        </div>
      </div>

      <div className="flex justify-center gap-4 border-t border-slate-800 pt-4">
        {status === 'armed' ? (
          <Button onClick={launch} className="bg-amber-600 hover:bg-amber-500 text-white font-bold tracking-wider uppercase px-8">
            {launchLabel}
          </Button>
        ) : (
          <Button onClick={reset} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 font-bold tracking-wider uppercase px-8">
            Reset (R)
          </Button>
        )}

        <Button
          onClick={() => setAutopilotEnabled(!autopilotEnabled)}
          variant={autopilotEnabled ? "default" : "outline"}
          className={`font-bold tracking-wider uppercase px-8 ${
            autopilotEnabled
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
        >
          Autopilot {autopilotEnabled ? 'ON' : 'OFF'} (P)
        </Button>

        {onBackToMissions && (
          <Button
            onClick={onBackToMissions}
            variant="ghost"
            className="text-slate-400 hover:text-white hover:bg-slate-800 font-bold tracking-wider uppercase px-6"
          >
            Missions (M)
          </Button>
        )}
      </div>

    </div>
  );
}
