import { useEffect } from 'react';
import { Controls } from '../lib/physics';

interface Options {
  controls: Controls;
  setControls: (c: Partial<Controls>) => void;
  reset: () => void;
  autopilotEnabled: boolean;
  setAutopilotEnabled: (b: boolean) => void;
  status: string;
  onBackToMissions?: () => void;
  enabled?: boolean;
}

/**
 * Global keyboard control bindings for the simulator. Lives in a hook so the
 * keyboard surface is always active (desktop with sliders, mobile with touch
 * pads, or hybrid devices) and is only mounted when `enabled` is true — e.g.
 * we suppress it during replay.
 *
 * Mappings:
 *   W / ↑     – throttle up (+10%)
 *   S / ↓     – throttle down (-10%)
 *   A / ←     – steer left (hold)
 *   D / →     – steer right (hold)
 *   SPACE     – full thrust (hold)
 *   P         – toggle autopilot
 *   R         – reset run
 *   M         – back to missions
 */
export function useKeyboardControls({
  controls,
  setControls,
  reset,
  autopilotEnabled,
  setAutopilotEnabled,
  status,
  onBackToMissions,
  enabled = true,
}: Options): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const k = e.key.toLowerCase();

      if (status === 'landed' || status === 'crashed') {
        if (k === 'r') reset();
        if (k === 'm' && onBackToMissions) onBackToMissions();
        return;
      }

      if (e.repeat) return;

      switch (k) {
        case 'w':
        case 'arrowup':
          if (!autopilotEnabled) setControls({ throttle: Math.min(1, controls.throttle + 0.1) });
          e.preventDefault();
          break;
        case 's':
        case 'arrowdown':
          if (!autopilotEnabled) setControls({ throttle: Math.max(0, controls.throttle - 0.1) });
          e.preventDefault();
          break;
        case 'a':
        case 'arrowleft':
          if (!autopilotEnabled) setControls({ gimbal: Math.max(-1, controls.gimbal - 0.2) });
          e.preventDefault();
          break;
        case 'd':
        case 'arrowright':
          if (!autopilotEnabled) setControls({ gimbal: Math.min(1, controls.gimbal + 0.2) });
          e.preventDefault();
          break;
        case ' ':
          if (!autopilotEnabled) setControls({ throttle: 1 });
          e.preventDefault();
          break;
        case 'p':
          setAutopilotEnabled(!autopilotEnabled);
          break;
        case 'r':
          reset();
          break;
        case 'm':
          if (onBackToMissions) onBackToMissions();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (status === 'landed' || status === 'crashed') return;
      const k = e.key.toLowerCase();
      switch (k) {
        case 'a':
        case 'd':
        case 'arrowleft':
        case 'arrowright':
          if (!autopilotEnabled) setControls({ gimbal: 0 });
          break;
        case ' ':
          if (!autopilotEnabled) setControls({ throttle: 0 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    controls,
    setControls,
    autopilotEnabled,
    setAutopilotEnabled,
    reset,
    status,
    onBackToMissions,
    enabled,
  ]);
}
