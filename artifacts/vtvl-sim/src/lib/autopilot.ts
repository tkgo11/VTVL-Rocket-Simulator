import { PhysicsState, Controls, MissionConfig, VehicleConfig, DEFAULT_VEHICLE } from './physics';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Cascaded landing controller:
 *
 *   Outer loop:  position x  -> desired horizontal velocity
 *   Mid loop:    velocity vx -> desired tilt angle (with feed-forward to fight drift)
 *   Inner loop:  angle err   -> gimbal command (PD on attitude)
 *
 *   Vertical:    altitude    -> desired descent rate (suicide-burn profile bounded
 *                               by the vehicle's actual deceleration capability)
 *                desired vy  -> throttle (feed-forward hover + P on velocity error)
 *
 * Mission and vehicle parameters (gravity, target pad, wind, dry mass, max
 * thrust) are consumed so the controller works on any planet, with any
 * vehicle preset, and steers to off-axis pads.
 */
export function computeAutopilotControls(
  state: PhysicsState,
  mission: MissionConfig,
  vehicle: VehicleConfig = DEFAULT_VEHICLE,
): Controls {
  // Pre-launch / post-flight: do nothing.
  if (
    state.status === 'armed' ||
    state.status === 'landed' ||
    state.status === 'crashed'
  ) {
    return { throttle: 0, gimbal: 0 };
  }

  const mass = vehicle.dryMass + state.fuel;
  const g = mission.gravity;
  const Tmax = vehicle.maxThrust;
  const hoverThrottle = (mass * g) / Tmax;
  // Max upward deceleration the engine can produce *right now*, with a safety
  // factor so we always have headroom against drag/tilt losses and mass change.
  const availDecel = Math.max(0.3, Tmax / mass - g);
  const safeDecel = availDecel * 0.6;

  // ---- Lateral control ----------------------------------------------------
  const errorX = mission.targetPadX - state.x;
  // Position -> desired vx (gentler when low to avoid last-second swings).
  const vxLimit = state.y > 50 ? 6 : state.y > 15 ? 3 : 1.5;
  const desiredVx = clamp(errorX * 0.18, -vxLimit, vxLimit);
  const errorVx = desiredVx - state.vx;

  // Velocity -> desired tilt. Tilt envelope shrinks near the ground.
  const maxTilt = (state.y > 50 ? 8 : state.y > 15 ? 4 : 2) * (Math.PI / 180);
  const desiredAngle = clamp(errorVx * 0.04, -maxTilt, maxTilt);

  // ---- Inner attitude PD --------------------------------------------------
  const errorAngle = desiredAngle - state.angle;
  const gimbalCmd = clamp(
    -(errorAngle * 2.5 - state.angularVelocity * 2.0),
    -1,
    1,
  );

  // ---- Vertical descent profile ------------------------------------------
  const yEff = Math.max(state.y - 1.5, 0);
  const sqrtTarget = -Math.sqrt(2 * safeDecel * yEff) - 0.5;
  let desiredVy = Math.max(sqrtTarget, -18);

  // Lateral health gate.
  const lateralErr = Math.hypot(mission.targetPadX - state.x, state.vx * 2);
  if (state.y > 40 && lateralErr > 15) {
    const factor = clamp(15 / lateralErr, 0.05, 1);
    desiredVy *= factor;
  }

  // Terminal flare.
  if (state.y < 8) desiredVy = Math.max(desiredVy, -2.5);
  if (state.y < 2) desiredVy = -0.8;
  if (state.y < 0.5) desiredVy = -0.4;

  const errorVy = desiredVy - state.vy;

  // Throttle: hover feed-forward + P on velocity error.
  let throttleCmd = hoverThrottle + errorVy * 0.18;

  // Anti-windup.
  if (state.vy > desiredVy + 4) throttleCmd = 0;

  throttleCmd = clamp(throttleCmd, 0, 1);
  if (state.fuel <= 0) throttleCmd = 0;

  return { throttle: throttleCmd, gimbal: gimbalCmd };
}
