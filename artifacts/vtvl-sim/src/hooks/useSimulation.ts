import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PhysicsState,
  Controls,
  MissionConfig,
  stepPhysics,
  createInitialState,
} from '../lib/physics';
import { computeAutopilotControls } from '../lib/autopilot';
import { computeScore, ScoreResult } from '../lib/scoring';
import { recordResult, LeaderboardEntry } from '../lib/leaderboard';

const FIXED_DT = 1 / 120; // 120Hz physics

export interface RunResult {
  score: ScoreResult;
  best: LeaderboardEntry | null;
  isNewBest: boolean;
  previousBest: LeaderboardEntry | null;
}

export function useSimulation(mission: MissionConfig) {
  const missionRef = useRef<MissionConfig>(mission);
  const stateRef = useRef<PhysicsState>(createInitialState(mission));
  const controlsRef = useRef<Controls>({ throttle: 0, gimbal: 0 });
  const autopilotEnabledRef = useRef(false);
  const lastStatusRef = useRef<PhysicsState['status']>(stateRef.current.status);
  const [renderState, setRenderState] = useState<PhysicsState>(stateRef.current);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [fps, setFps] = useState(0);

  const reset = useCallback(() => {
    stateRef.current = createInitialState(missionRef.current);
    controlsRef.current = { throttle: 0, gimbal: 0 };
    autopilotEnabledRef.current = false;
    lastStatusRef.current = stateRef.current.status;
    setRunResult(null);
    setRenderState({ ...stateRef.current });
  }, []);

  // When the mission changes, fully reset the simulator state.
  useEffect(() => {
    missionRef.current = mission;
    reset();
  }, [mission, reset]);

  const launch = useCallback(() => {
    const m = missionRef.current;
    const fresh = createInitialState(m);
    if (m.startMode === 'launch') {
      stateRef.current = { ...fresh, status: 'ascent' };
      controlsRef.current = { throttle: 1, gimbal: 0 };
    } else {
      stateRef.current = { ...fresh, status: 'descent' };
      controlsRef.current = { throttle: 0, gimbal: 0 };
    }
    lastStatusRef.current = stateRef.current.status;
    setRunResult(null);
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
        const m = missionRef.current;
        if (autopilotEnabledRef.current) {
          controlsRef.current = computeAutopilotControls(stateRef.current, m);
        }
        stateRef.current = stepPhysics(stateRef.current, controlsRef.current, FIXED_DT, m);
        accumulator -= FIXED_DT;
      }

      // Detect end-of-run transition and compute the score exactly once.
      const status = stateRef.current.status;
      if (
        (status === 'landed' || status === 'crashed') &&
        lastStatusRef.current !== status
      ) {
        const score = computeScore(stateRef.current, missionRef.current);
        const persisted = recordResult(missionRef.current.id, score);
        setRunResult({
          score,
          best: persisted.entry,
          isNewBest: persisted.isNewBest,
          previousBest: persisted.previous,
        });
      }
      lastStatusRef.current = status;

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
    runResult,
    mission,
  };
}
