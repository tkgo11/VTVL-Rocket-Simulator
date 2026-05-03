import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Controls } from '../lib/physics';
import { Button } from './ui/button';

interface TouchControlsProps {
  controls: Controls;
  setControls: (controls: Partial<Controls>) => void;
  launch: () => void;
  reset: () => void;
  autopilotEnabled: boolean;
  setAutopilotEnabled: (enabled: boolean) => void;
  status: string;
  launchLabel?: string;
  onBackToMissions?: () => void;
}

interface HoldButtonProps {
  onPress: () => void;
  onRelease: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  ariaLabel: string;
  testId?: string;
}

/**
 * A press-and-hold button. Calls `onPress` on pointerdown, `onRelease` on
 * pointerup / pointercancel / pointerleave. Mirrors the keyboard
 * down/up semantics for throttle BURN and gimbal steering.
 *
 * If the button becomes `disabled` mid-press (autopilot toggled on, run
 * ends, etc.) or the component unmounts, we synthesize a release so the
 * underlying control (throttle / gimbal) doesn't get stuck on.
 */
function HoldButton({
  onPress,
  onRelease,
  disabled,
  className,
  children,
  ariaLabel,
  testId,
}: HoldButtonProps) {
  const activeRef = useRef(false);
  const onReleaseRef = useRef(onRelease);
  onReleaseRef.current = onRelease;

  const forceRelease = () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    onReleaseRef.current();
  };

  // Disabled flipping true while held → fire release so state doesn't stick.
  useEffect(() => {
    if (disabled && activeRef.current) {
      forceRelease();
    }
  }, [disabled]);

  // Unmount safety net.
  useEffect(() => {
    return () => {
      forceRelease();
    };
  }, []);

  const press = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    if (activeRef.current) return;
    activeRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore — pointer capture is best-effort
    }
    onPress();
  };

  const release = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!activeRef.current) return;
    e.preventDefault();
    activeRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    onRelease();
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      disabled={disabled}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      className={className}
    >
      {children}
    </button>
  );
}

export function TouchControls({
  controls,
  setControls,
  launch,
  reset,
  autopilotEnabled,
  setAutopilotEnabled,
  status,
  launchLabel = 'Launch',
  onBackToMissions,
}: TouchControlsProps) {
  const ended = status === 'landed' || status === 'crashed';
  const armed = status === 'armed';
  const flightDisabled = autopilotEnabled || ended;

  // Gimbal: hold = steer (settles back to centre on release).
  const gimbalLeftPress = () => setControls({ gimbal: -0.7 });
  const gimbalRightPress = () => setControls({ gimbal: 0.7 });
  const gimbalRelease = () => setControls({ gimbal: 0 });

  // Throttle: BURN hold mirrors SPACE; ± buttons mirror W/S step behaviour.
  const burnPress = () => setControls({ throttle: 1 });
  const burnRelease = () => setControls({ throttle: 0 });
  const throttleUp = () =>
    setControls({ throttle: Math.min(1, controls.throttle + 0.1) });
  const throttleDown = () =>
    setControls({ throttle: Math.max(0, controls.throttle - 0.1) });

  const padBtn =
    'flex-1 h-16 rounded-md bg-slate-900/80 active:bg-amber-600/40 border border-slate-800 text-amber-300 text-2xl font-bold disabled:opacity-40 disabled:active:bg-slate-900/80 touch-none';
  const stepBtn =
    'w-11 h-16 rounded-md bg-slate-900/80 active:bg-slate-700 border border-slate-800 text-slate-200 text-xl font-bold disabled:opacity-40 disabled:active:bg-slate-900/80 touch-none';

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 pointer-events-none select-none"
      data-testid="touch-controls"
    >
      <div className="mx-auto max-w-[640px] px-3 pb-3 pt-3 flex flex-col gap-2 pointer-events-auto bg-gradient-to-t from-black/85 via-black/65 to-transparent">
        {/* Action row */}
        <div className="flex items-center justify-center gap-2">
          {armed ? (
            <Button
              onClick={launch}
              data-testid="touch-launch"
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold tracking-wider uppercase h-9 px-5 text-xs"
            >
              {launchLabel}
            </Button>
          ) : (
            <Button
              onClick={reset}
              data-testid="touch-reset"
              variant="outline"
              className="h-9 px-5 border-slate-700 text-slate-200 hover:bg-slate-800 font-bold tracking-wider uppercase text-xs"
            >
              Reset
            </Button>
          )}
          <Button
            onClick={() => setAutopilotEnabled(!autopilotEnabled)}
            data-testid="touch-autopilot"
            variant={autopilotEnabled ? 'default' : 'outline'}
            className={`h-9 px-4 font-bold tracking-wider uppercase text-xs ${
              autopilotEnabled
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
          >
            AP {autopilotEnabled ? 'ON' : 'OFF'}
          </Button>
          {onBackToMissions && (
            <Button
              onClick={onBackToMissions}
              data-testid="touch-missions"
              variant="ghost"
              className="h-9 px-3 text-slate-300 hover:text-white hover:bg-slate-800 font-bold tracking-wider uppercase text-xs"
            >
              Missions
            </Button>
          )}
        </div>

        {/* Pad row: gimbal | throttle */}
        <div className="flex items-stretch gap-2">
          {/* Gimbal pad */}
          <div className="flex-1 flex flex-col gap-1 bg-black/70 border border-slate-800 rounded-lg p-1.5">
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-500 text-center">
              Gimbal
            </div>
            <div className="flex gap-1.5">
              <HoldButton
                ariaLabel="Steer left"
                testId="touch-gimbal-left"
                disabled={flightDisabled}
                onPress={gimbalLeftPress}
                onRelease={gimbalRelease}
                className={padBtn}
              >
                ◀
              </HoldButton>
              <HoldButton
                ariaLabel="Steer right"
                testId="touch-gimbal-right"
                disabled={flightDisabled}
                onPress={gimbalRightPress}
                onRelease={gimbalRelease}
                className={padBtn}
              >
                ▶
              </HoldButton>
            </div>
          </div>

          {/* Throttle pad */}
          <div className="flex-1 flex flex-col gap-1 bg-black/70 border border-slate-800 rounded-lg p-1.5">
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-500 text-center">
              Throttle · {Math.round(controls.throttle * 100)}%
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={throttleDown}
                disabled={flightDisabled}
                aria-label="Throttle down"
                data-testid="touch-throttle-down"
                className={stepBtn}
              >
                −
              </button>
              <HoldButton
                ariaLabel="Burn at maximum thrust"
                testId="touch-burn"
                disabled={flightDisabled}
                onPress={burnPress}
                onRelease={burnRelease}
                className="flex-1 h-16 rounded-md bg-amber-600/20 active:bg-amber-500/60 border border-amber-700/60 text-amber-100 font-bold tracking-[0.25em] uppercase text-sm disabled:opacity-40 disabled:active:bg-amber-600/20 touch-none flex items-center justify-center"
              >
                Burn
              </HoldButton>
              <button
                type="button"
                onClick={throttleUp}
                disabled={flightDisabled}
                aria-label="Throttle up"
                data-testid="touch-throttle-up"
                className={stepBtn}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
