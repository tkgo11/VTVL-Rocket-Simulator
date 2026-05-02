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
import {
  FlightRecording,
  RecordingFrame,
  downsampleFrames,
  frameFromState,
  makeRecordingId,
  sampleRecording,
} from '../lib/recording';

const FIXED_DT = 1 / 120; // 120Hz physics
const RECORDING_HZ = 60;  // sample at most this often into the recording buffer
const PERSIST_HZ = 30;    // resampled rate for the persisted/replay frames
const MAX_RECORDING_FRAMES = 7200; // ~2 minutes at 60Hz, hard safety cap

export interface RunResult {
  score: ScoreResult;
  best: LeaderboardEntry | null;
  isNewBest: boolean;
  previousBest: LeaderboardEntry | null;
}

export interface WindOverride {
  speed: number;
  gust: number;
}

export interface ReplayState {
  recording: FlightRecording | null;
  time: number;
  playing: boolean;
  speed: number;
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

  // -- Wind override (live-tunable, derived from mission defaults) --
  const [windOverride, setWindOverrideState] = useState<WindOverride>({
    speed: mission.wind,
    gust: mission.windGust,
  });

  // -- Recording capture --
  const recordingFramesRef = useRef<RecordingFrame[]>([]);
  const recordingActiveRef = useRef(false);
  const lastRecordedTRef = useRef(-Infinity);
  const [latestRecording, setLatestRecording] = useState<FlightRecording | null>(null);

  // -- Replay --
  const [replay, setReplay] = useState<ReplayState>({
    recording: null,
    time: 0,
    playing: false,
    speed: 1,
  });
  const replayRef = useRef(replay);
  replayRef.current = replay;

  // Compose the *effective* mission (mission + live wind override). The
  // physics loop reads missionRef.current directly, so we keep it pointing
  // at the composed object whenever inputs change.
  const composeMission = useCallback(
    (m: MissionConfig, w: WindOverride): MissionConfig => ({
      ...m,
      wind: w.speed,
      windGust: Math.max(0, w.gust),
    }),
    [],
  );

  const reset = useCallback(() => {
    stateRef.current = createInitialState(missionRef.current);
    controlsRef.current = { throttle: 0, gimbal: 0 };
    autopilotEnabledRef.current = false;
    lastStatusRef.current = stateRef.current.status;
    recordingFramesRef.current = [];
    recordingActiveRef.current = false;
    lastRecordedTRef.current = -Infinity;
    setRunResult(null);
    setLatestRecording(null);
    setReplay({ recording: null, time: 0, playing: false, speed: 1 });
    setRenderState({ ...stateRef.current });
  }, []);

  // When the mission changes, fully reset the simulator state and snap the
  // wind override back to the mission's defaults.
  useEffect(() => {
    const defaults = { speed: mission.wind, gust: mission.windGust };
    setWindOverrideState(defaults);
    missionRef.current = composeMission(mission, defaults);
    reset();
  }, [mission, reset, composeMission]);

  const setWindOverride = useCallback(
    (next: Partial<WindOverride>) => {
      setWindOverrideState((prev) => {
        const merged: WindOverride = {
          speed: next.speed ?? prev.speed,
          gust: Math.max(0, next.gust ?? prev.gust),
        };
        // Apply immediately to the live mission ref so the physics loop sees
        // the change on the very next step (no one-frame stale window).
        missionRef.current = composeMission(missionRef.current, merged);
        return merged;
      });
    },
    [composeMission],
  );

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
    // Begin a fresh recording. Seed the buffer with the launch state so the
    // timeline starts exactly where the rocket was at t=0.
    recordingFramesRef.current = [frameFromState(stateRef.current)];
    recordingActiveRef.current = true;
    lastRecordedTRef.current = stateRef.current.t;
    setRunResult(null);
    setLatestRecording(null);
    setReplay({ recording: null, time: 0, playing: false, speed: 1 });
  }, []);

  const setControls = useCallback((newControls: Partial<Controls>) => {
    controlsRef.current = { ...controlsRef.current, ...newControls };
  }, []);

  const setAutopilotEnabled = useCallback((enabled: boolean) => {
    autopilotEnabledRef.current = enabled;
  }, []);

  // ---- Replay controls ----
  const enterReplay = useCallback((recording: FlightRecording) => {
    setReplay({ recording, time: 0, playing: true, speed: 1 });
  }, []);

  const exitReplay = useCallback(() => {
    setReplay({ recording: null, time: 0, playing: false, speed: 1 });
    // Snap the rendered state back to whatever the live sim is showing.
    setRenderState({ ...stateRef.current });
  }, []);

  const seekReplay = useCallback((t: number) => {
    setReplay((prev) => {
      if (!prev.recording) return prev;
      const clamped = Math.max(
        0,
        Math.min(prev.recording.duration, t),
      );
      return { ...prev, time: clamped, playing: false };
    });
  }, []);

  const setReplayPlaying = useCallback((playing: boolean) => {
    setReplay((prev) => {
      if (!prev.recording) return prev;
      // If we're at the end and the user hits play, restart from the top.
      const atEnd = prev.time >= prev.recording.duration - 1e-3;
      return {
        ...prev,
        time: playing && atEnd ? 0 : prev.time,
        playing,
      };
    });
  }, []);

  const setReplaySpeed = useCallback((speed: number) => {
    setReplay((prev) => ({ ...prev, speed }));
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

      const replayState = replayRef.current;

      // ---------------- REPLAY MODE ----------------
      if (replayState.recording) {
        let nextT = replayState.time;
        if (replayState.playing) {
          nextT = Math.min(
            replayState.recording.duration,
            replayState.time + dt * replayState.speed,
          );
          const finished = nextT >= replayState.recording.duration - 1e-6;
          // Update React state so the scrubber follows along.
          setReplay((prev) => {
            if (!prev.recording) return prev;
            return {
              ...prev,
              time: nextT,
              playing: finished ? false : prev.playing,
            };
          });
        }
        const frame = sampleRecording(replayState.recording, nextT);
        setRenderState(frame);

        frames++;
        if (time - lastFpsTime >= 1000) {
          setFps(frames);
          frames = 0;
          lastFpsTime = time;
        }
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      // ---------------- LIVE MODE ----------------
      // Prevent spiral of death
      accumulator += Math.min(dt, 0.1);

      while (accumulator >= FIXED_DT) {
        const m = missionRef.current;
        if (autopilotEnabledRef.current) {
          controlsRef.current = computeAutopilotControls(stateRef.current, m);
        }
        stateRef.current = stepPhysics(
          stateRef.current,
          controlsRef.current,
          FIXED_DT,
          m,
        );
        accumulator -= FIXED_DT;
      }

      // Append to the recording buffer (throttled by RECORDING_HZ).
      if (
        recordingActiveRef.current &&
        recordingFramesRef.current.length < MAX_RECORDING_FRAMES
      ) {
        const t = stateRef.current.t;
        if (t - lastRecordedTRef.current >= 1 / RECORDING_HZ) {
          recordingFramesRef.current.push(frameFromState(stateRef.current));
          lastRecordedTRef.current = t;
        }
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

        // Finalize the recording: append the impact frame and downsample for
        // storage efficiency.
        if (recordingActiveRef.current) {
          recordingFramesRef.current.push(frameFromState(stateRef.current));
          recordingActiveRef.current = false;
          // Persist at a lower rate than capture; the timeline interpolates
          // between frames so 30Hz still scrubs smoothly while keeping the
          // localStorage payload small for long flights.
          const compactFrames = downsampleFrames(
            recordingFramesRef.current,
            PERSIST_HZ,
          );
          const m = missionRef.current;
          const recording: FlightRecording = {
            id: makeRecordingId(),
            missionId: m.id,
            missionName: m.name,
            date: new Date().toISOString(),
            outcome: status,
            duration: stateRef.current.t,
            finalScore: score.total,
            finalGrade: score.grade,
            windSpeed: m.wind,
            windGust: m.windGust,
            frames: compactFrames,
          };
          setLatestRecording(recording);
        }
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
    mission: missionRef.current,
    // Wind
    windOverride,
    setWindOverride,
    // Recording / replay
    latestRecording,
    replay,
    enterReplay,
    exitReplay,
    seekReplay,
    setReplayPlaying,
    setReplaySpeed,
  };
}
