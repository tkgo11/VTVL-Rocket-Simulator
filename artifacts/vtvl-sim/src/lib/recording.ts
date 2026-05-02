import { PhysicsState, SimStatus } from './physics';
import { Grade } from './scoring';

export interface RecordingFrame {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  throttle: number;
  gimbal: number;
  fuel: number;
  windNow: number;
  status: SimStatus;
}

export interface FlightRecording {
  id: string;
  missionId: string;
  missionName: string;
  date: string;
  outcome: 'landed' | 'crashed';
  duration: number;
  finalScore: number;
  finalGrade: Grade;
  windSpeed: number;
  windGust: number;
  frames: RecordingFrame[];
}

export function frameFromState(state: PhysicsState): RecordingFrame {
  return {
    t: state.t,
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    angle: state.angle,
    angularVelocity: state.angularVelocity,
    throttle: state.throttle,
    gimbal: state.gimbal,
    fuel: state.fuel,
    windNow: state.windNow,
    status: state.status,
  };
}

export function frameToState(frame: RecordingFrame): PhysicsState {
  return {
    t: frame.t,
    x: frame.x,
    y: frame.y,
    vx: frame.vx,
    vy: frame.vy,
    angle: frame.angle,
    angularVelocity: frame.angularVelocity,
    throttle: frame.throttle,
    gimbal: frame.gimbal,
    fuel: frame.fuel,
    windNow: frame.windNow,
    status: frame.status,
    touchdownVx: null,
    touchdownVy: null,
    touchdownAngle: null,
  };
}

/**
 * Linearly interpolate between two adjacent recorded frames at time `t` (in
 * seconds since the start of the flight). Returns a synthetic PhysicsState so
 * the existing renderers can be reused for replay without modification.
 */
export function sampleRecording(rec: FlightRecording, t: number): PhysicsState {
  const frames = rec.frames;
  if (frames.length === 0) {
    return frameToState({
      t: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      angularVelocity: 0,
      throttle: 0,
      gimbal: 0,
      fuel: 0,
      windNow: 0,
      status: 'armed',
    });
  }
  if (t <= frames[0].t) return frameToState(frames[0]);
  if (t >= frames[frames.length - 1].t) {
    return frameToState(frames[frames.length - 1]);
  }

  // Binary search for the surrounding frames.
  let lo = 0;
  let hi = frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = frames[lo];
  const b = frames[hi];
  const dt = b.t - a.t;
  const u = dt > 0 ? (t - a.t) / dt : 0;
  const lerp = (x: number, y: number) => x + (y - x) * u;
  return {
    t,
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y),
    vx: lerp(a.vx, b.vx),
    vy: lerp(a.vy, b.vy),
    angle: lerp(a.angle, b.angle),
    angularVelocity: lerp(a.angularVelocity, b.angularVelocity),
    throttle: lerp(a.throttle, b.throttle),
    gimbal: lerp(a.gimbal, b.gimbal),
    fuel: lerp(a.fuel, b.fuel),
    windNow: lerp(a.windNow, b.windNow),
    // Status is discrete; flip at the second frame.
    status: u < 1 ? a.status : b.status,
    touchdownVx: null,
    touchdownVy: null,
    touchdownAngle: null,
  };
}

const STORAGE_KEY = 'vtvl_recordings_v1';
const MAX_STORED = 20;

export function getSavedRecordings(): FlightRecording[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Light validation - drop entries that don't look like recordings.
    return (parsed as unknown[]).filter(
      (r): r is FlightRecording =>
        !!r &&
        typeof r === 'object' &&
        Array.isArray((r as FlightRecording).frames) &&
        typeof (r as FlightRecording).id === 'string',
    );
  } catch {
    return [];
  }
}

export function saveRecording(rec: FlightRecording): FlightRecording[] {
  if (typeof window === 'undefined') return [];
  const existing = getSavedRecordings().filter((r) => r.id !== rec.id);
  const next = [rec, ...existing].slice(0, MAX_STORED);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded etc. - try once more after dropping the oldest.
    if (next.length > 1) {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(next.slice(0, Math.max(1, next.length - 5))),
        );
      } catch {
        // give up silently
      }
    }
  }
  return next;
}

export function deleteRecording(id: string): FlightRecording[] {
  if (typeof window === 'undefined') return [];
  const next = getSavedRecordings().filter((r) => r.id !== id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function makeRecordingId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Reduce frame density to roughly `targetHz` so a long flight doesn't bloat
 * localStorage. Always preserves the first and last frames so the trajectory
 * starts and ends exactly where the live flight did.
 */
export function downsampleFrames(
  frames: RecordingFrame[],
  targetHz: number = 30,
): RecordingFrame[] {
  if (frames.length <= 2) return frames.slice();
  const minDt = 1 / targetHz;
  const out: RecordingFrame[] = [frames[0]];
  let lastT = frames[0].t;
  for (let i = 1; i < frames.length - 1; i++) {
    if (frames[i].t - lastT >= minDt) {
      out.push(frames[i]);
      lastT = frames[i].t;
    }
  }
  out.push(frames[frames.length - 1]);
  return out;
}
