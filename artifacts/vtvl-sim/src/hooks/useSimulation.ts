import { useState, useEffect, useRef, useCallback } from 'react';
import { PhysicsState, Controls, stepPhysics, initialState } from '../lib/physics';
import { computeAutopilotControls } from '../lib/autopilot';

const FIXED_DT = 1 / 120; // 120Hz physics

export function useSimulation() {
  const stateRef = useRef<PhysicsState>({ ...initialState });
  const controlsRef = useRef<Controls>({ throttle: 0, gimbal: 0 });
  const autopilotEnabledRef = useRef(false);
  const [renderState, setRenderState] = useState<PhysicsState>({ ...initialState });
  const [fps, setFps] = useState(0);

  const launch = useCallback(() => {
    stateRef.current = { ...initialState, status: 'ascent' };
    controlsRef.current = { throttle: 1, gimbal: 0 };
  }, []);

  const reset = useCallback(() => {
    stateRef.current = { ...initialState };
    controlsRef.current = { throttle: 0, gimbal: 0 };
    autopilotEnabledRef.current = false;
  }, []);

  const setControls = useCallback((newControls: Partial<Controls>) => {
    controlsRef.current = { ...controlsRef.current, ...newControls };
  }, []);

  const setAutopilotEnabled = useCallback((enabled: boolean) => {
    autopilotEnabledRef.current = enabled;
  }, []);

  useEffect(() => {
    let lastTime = performance.now();
    let accumulator = 0;
    let frames = 0;
    let lastFpsTime = lastTime;
    let animationFrameId: number;

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      
      // Prevent spiral of death
      accumulator += Math.min(dt, 0.1); 

      while (accumulator >= FIXED_DT) {
        if (autopilotEnabledRef.current) {
          controlsRef.current = computeAutopilotControls(stateRef.current);
        }
        stateRef.current = stepPhysics(stateRef.current, controlsRef.current, FIXED_DT);
        accumulator -= FIXED_DT;
      }

      setRenderState({ ...stateRef.current });

      frames++;
      if (time - lastFpsTime >= 1000) {
        setFps(frames);
        frames = 0;
        lastFpsTime = time;
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return {
    state: renderState,
    controls: controlsRef.current,
    setControls,
    launch,
    reset,
    autopilotEnabled: autopilotEnabledRef.current,
    setAutopilotEnabled,
    fps,
  };
}
