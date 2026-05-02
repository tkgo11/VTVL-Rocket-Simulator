export type SimStatus = 'armed' | 'ascent' | 'descent' | 'landed' | 'crashed';

export interface PhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  throttle: number;
  gimbal: number;
  fuel: number;
  status: SimStatus;
  t: number;
  windNow: number;
  // Velocities and angle captured at the instant of ground contact, before the
  // landing handler sanitizes them to zero. Used by the scoring system so
  // touchdown velocity and tilt reflect the *actual* impact, not the cleaned
  // resting state. Null until the rocket has touched down.
  touchdownVx: number | null;
  touchdownVy: number | null;
  touchdownAngle: number | null;
}

export interface Controls {
  throttle: number;
  gimbal: number;
}

export type MissionStartMode = 'launch' | 'descent';

export interface MissionConfig {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  startMode: MissionStartMode;
  startAltitude: number;
  startVx?: number;
  startVy?: number;
  fuel: number;
  targetPadX: number;
  padRadius: number;
  gravity: number;
  wind: number;
  windGust: number;
  airDensity: number;
}

// Vehicle constants (mission-independent).
export const CONSTANTS = {
  GRAVITY: 9.81,
  DRY_MASS: 25000,
  INITIAL_FUEL: 50000,
  MAX_THRUST: 845000,
  ISP: 282,
  MAX_GIMBAL_ANGLE: 15 * (Math.PI / 180),
  LENGTH: 40,
  DIAMETER: 3.7,
  LEVER_ARM: 15,
  DRAG_COEF: 0.5,
  AIR_DENSITY: 1.225,
  ANGULAR_DAMPING: 0.05,
};

export function createInitialState(mission: MissionConfig): PhysicsState {
  return {
    x: 0,
    y: mission.startAltitude,
    vx: mission.startVx ?? 0,
    vy: mission.startVy ?? 0,
    angle: 0,
    angularVelocity: 0,
    throttle: 0,
    gimbal: 0,
    fuel: mission.fuel,
    status: 'armed',
    t: 0,
    windNow: mission.wind,
    touchdownVx: null,
    touchdownVy: null,
    touchdownAngle: null,
  };
}

export function currentWind(mission: MissionConfig, t: number): number {
  if (mission.windGust === 0) return mission.wind;
  // Two superposed sines so the gust pattern doesn't feel periodic.
  const gust =
    Math.sin(t * 0.7) * 0.6 + Math.sin(t * 1.7 + 1.3) * 0.4;
  return mission.wind + gust * mission.windGust;
}

export function stepPhysics(
  state: PhysicsState,
  controls: Controls,
  dt: number,
  mission: MissionConfig,
): PhysicsState {
  if (state.status === 'landed' || state.status === 'crashed') {
    return state;
  }

  // Pre-launch: vehicle is held on the pad. No integration runs until the
  // user presses Launch (which transitions status away from 'armed').
  if (state.status === 'armed') {
    return {
      ...state,
      throttle: 0,
      gimbal: 0,
      vx: 0,
      vy: 0,
      angularVelocity: 0,
      windNow: currentWind(mission, state.t),
    };
  }

  const newState = { ...state };
  newState.t = state.t + dt;
  const wind = currentWind(mission, newState.t);
  newState.windNow = wind;

  newState.throttle = Math.max(0, Math.min(1, controls.throttle));
  newState.gimbal = Math.max(-1, Math.min(1, controls.gimbal));

  if (newState.fuel <= 0) {
    newState.throttle = 0;
  }

  const mass = CONSTANTS.DRY_MASS + newState.fuel;
  const momentOfInertia = (1 / 12) * mass * Math.pow(CONSTANTS.LENGTH, 2);
  const area = Math.PI * Math.pow(CONSTANTS.DIAMETER / 2, 2);

  // Mass loss
  const thrust = newState.throttle * CONSTANTS.MAX_THRUST;
  const mdot = thrust / (CONSTANTS.ISP * CONSTANTS.GRAVITY);
  newState.fuel = Math.max(0, newState.fuel - mdot * dt);

  // Thrust forces
  const gimbalAngle = newState.gimbal * CONSTANTS.MAX_GIMBAL_ANGLE;
  const thrustAngle = newState.angle + gimbalAngle;

  const thrust_x = thrust * Math.sin(thrustAngle);
  const thrust_y = thrust * Math.cos(thrustAngle);

  // Drag forces (relative to local wind)
  const vRelX = newState.vx - wind;
  const vRelY = newState.vy;
  const speedRel = Math.sqrt(vRelX * vRelX + vRelY * vRelY);
  const drag_mag =
    0.5 * mission.airDensity * CONSTANTS.DRAG_COEF * area * speedRel * speedRel;
  const drag_x = speedRel > 0 ? -drag_mag * (vRelX / speedRel) : 0;
  const drag_y = speedRel > 0 ? -drag_mag * (vRelY / speedRel) : 0;

  // Linear acceleration
  const ax = (thrust_x + drag_x) / mass;
  const ay = (thrust_y + drag_y) / mass - mission.gravity;

  // Torque and angular acceleration
  const torque = -thrust * Math.sin(gimbalAngle) * CONSTANTS.LEVER_ARM;
  const angularAccel = torque / momentOfInertia;

  // Update velocities
  newState.vx += ax * dt;
  newState.vy += ay * dt;
  newState.angularVelocity += angularAccel * dt;

  // Damping
  newState.angularVelocity -= newState.angularVelocity * CONSTANTS.ANGULAR_DAMPING * dt;

  // Update positions
  newState.x += newState.vx * dt;
  newState.y += newState.vy * dt;
  newState.angle += newState.angularVelocity * dt;

  // Status transitions. 'armed' is handled by the early return above, so by
  // this point status is one of: 'ascent' | 'descent'.
  if (newState.status === 'ascent' && newState.vy < -0.1) newState.status = 'descent';

  // Ground collision
  if (newState.y <= 0) {
    newState.y = 0;
    // Capture the actual impact metrics before any cleanup so the scoring
    // system can grade the real touchdown rather than the resting state.
    newState.touchdownVx = newState.vx;
    newState.touchdownVy = newState.vy;
    newState.touchdownAngle = newState.angle;

    const isSoftLanding =
      Math.abs(newState.vy) < 5 &&
      Math.abs(newState.vx) < 2 &&
      Math.abs(newState.angle) < (10 * Math.PI / 180);

    if (isSoftLanding) {
      newState.status = 'landed';
      newState.vx = 0;
      newState.vy = 0;
      newState.angularVelocity = 0;
      newState.angle = 0;
      newState.throttle = 0;
    } else {
      newState.status = 'crashed';
      newState.throttle = 0;
    }
  }

  return newState;
}
