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
}

export interface Controls {
  throttle: number;
  gimbal: number;
}

// Constants
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

export const initialState: PhysicsState = {
  x: 0,
  y: 200,
  vx: 0,
  vy: 0,
  angle: 0,
  angularVelocity: 0,
  throttle: 0,
  gimbal: 0,
  fuel: CONSTANTS.INITIAL_FUEL,
  status: 'armed',
};

export function stepPhysics(state: PhysicsState, controls: Controls, dt: number): PhysicsState {
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
    };
  }

  const newState = { ...state };

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

  // Drag forces
  const speed = Math.sqrt(newState.vx * newState.vx + newState.vy * newState.vy);
  const drag_mag = 0.5 * CONSTANTS.AIR_DENSITY * CONSTANTS.DRAG_COEF * area * speed * speed;
  const drag_x = speed > 0 ? -drag_mag * (newState.vx / speed) : 0;
  const drag_y = speed > 0 ? -drag_mag * (newState.vy / speed) : 0;

  // Linear acceleration
  const ax = (thrust_x + drag_x) / mass;
  const ay = (thrust_y + drag_y) / mass - CONSTANTS.GRAVITY;

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

  // Status transitions
  if (newState.status === 'armed' && newState.y > 200.1) newState.status = 'ascent';
  if (newState.status === 'ascent' && newState.vy < -0.1) newState.status = 'descent';
  if (newState.status === 'armed' && newState.vy < -0.1) newState.status = 'descent';

  // Ground collision
  if (newState.y <= 0) {
    newState.y = 0;
    const isSoftLanding = Math.abs(newState.vy) < 5 && Math.abs(newState.vx) < 2 && Math.abs(newState.angle) < (10 * Math.PI / 180);
    
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
