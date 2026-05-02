import { MissionConfig, PhysicsState } from './physics';

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface ScoreBreakdown {
  velocity: number;
  accuracy: number;
  fuel: number;
  tilt: number;
}

export interface ScoreResult {
  total: number;
  grade: Grade;
  breakdown: ScoreBreakdown;
  metrics: {
    touchdownSpeed: number;
    padDeviation: number;
    fuelRemaining: number;
    fuelFraction: number;
    tiltDeg: number;
  };
  crashed: boolean;
}

const MAX_VELOCITY = 300;
const MAX_ACCURACY = 300;
const MAX_FUEL = 200;
const MAX_TILT = 200;
export const MAX_SCORE = MAX_VELOCITY + MAX_ACCURACY + MAX_FUEL + MAX_TILT;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function gradeFor(total: number, crashed: boolean): Grade {
  if (crashed) return 'F';
  if (total >= 950) return 'A+';
  if (total >= 850) return 'A';
  if (total >= 700) return 'B';
  if (total >= 550) return 'C';
  if (total >= 400) return 'D';
  return 'F';
}

export function computeScore(
  state: PhysicsState,
  mission: MissionConfig,
): ScoreResult {
  const crashed = state.status === 'crashed';

  // Prefer the touchdown snapshot taken at impact (before stepPhysics zeroes
  // the soft-landing state) so velocity / tilt grading reflects the actual
  // impact. Fall back to current state for safety if not available.
  const impactVx = state.touchdownVx ?? state.vx;
  const impactVy = state.touchdownVy ?? state.vy;
  const impactAngle = state.touchdownAngle ?? state.angle;

  const touchdownSpeed = Math.hypot(impactVx, impactVy);
  const padDeviation = Math.abs(state.x - mission.targetPadX);
  const fuelRemaining = state.fuel;
  const fuelFraction = mission.fuel > 0 ? fuelRemaining / mission.fuel : 0;
  const tiltDeg = Math.abs(impactAngle) * (180 / Math.PI);

  if (crashed) {
    return {
      total: 0,
      grade: 'F',
      breakdown: { velocity: 0, accuracy: 0, fuel: 0, tilt: 0 },
      metrics: {
        touchdownSpeed,
        padDeviation,
        fuelRemaining,
        fuelFraction,
        tiltDeg,
      },
      crashed: true,
    };
  }

  // Touchdown velocity: full marks at <=0.3 m/s, 0 at the soft-landing
  // threshold (~5 m/s combined).
  const velocity = Math.round(MAX_VELOCITY * clamp01(1 - (touchdownSpeed - 0.3) / 4.5));

  // Pad accuracy: full marks if you put it down inside padRadius/3, falling
  // off to 0 at 1.5x the pad radius.
  const inner = mission.padRadius / 3;
  const outer = mission.padRadius * 1.5;
  const accuracy = Math.round(
    MAX_ACCURACY * clamp01(1 - (padDeviation - inner) / (outer - inner)),
  );

  // Fuel remaining: linear with starting propellant.
  const fuel = Math.round(MAX_FUEL * clamp01(fuelFraction));

  // Tilt: full marks below 0.5deg, 0 at 8deg.
  const tilt = Math.round(MAX_TILT * clamp01(1 - (tiltDeg - 0.5) / 7.5));

  const total = velocity + accuracy + fuel + tilt;

  return {
    total,
    grade: gradeFor(total, false),
    breakdown: { velocity, accuracy, fuel, tilt },
    metrics: {
      touchdownSpeed,
      padDeviation,
      fuelRemaining,
      fuelFraction,
      tiltDeg,
    },
    crashed: false,
  };
}

export const GRADE_COLORS: Record<Grade, string> = {
  'A+': 'text-emerald-300',
  A: 'text-green-400',
  B: 'text-lime-400',
  C: 'text-amber-400',
  D: 'text-orange-400',
  F: 'text-red-500',
};
