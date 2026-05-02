import { PhysicsState, Controls, CONSTANTS } from './physics';

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
 * The descent profile is derived from the rocket's *available* upward
 * deceleration (T_max / m - g). With a safety factor we guarantee the burn
 * altitude is reachable, then a soft terminal flare brings vy to ~0 at touchdown.
 */
export function computeAutopilotControls(state: PhysicsState): Controls {
  // Pre-launch / post-flight: do nothing.
  if (
    state.status === 'armed' ||
    state.status === 'landed' ||
    state.status === 'crashed'
  ) {
    return { throttle: 0, gimbal: 0 };
  }

  const mass = CONSTANTS.DRY_MASS + state.fuel;
  const g = CONSTANTS.GRAVITY;
  const Tmax = CONSTANTS.MAX_THRUST;
  const hoverThrottle = (mass * g) / Tmax;
  // Max upward deceleration the engine can produce *right now*, with a safety
  // factor so we always have headroom against drag/tilt losses and mass change.
  const availDecel = Math.max(0.3, Tmax / mass - g);
  const safeDecel = availDecel * 0.6;

  // ---- Lateral control ----------------------------------------------------
  const errorX = -state.x;
  // Position -> desired vx (gentler when low to avoid last-second swings).
  const vxLimit = state.y > 50 ? 6 : state.y > 15 ? 3 : 1.5;
  const desiredVx = clamp(errorX * 0.18, -vxLimit, vxLimit);
  const errorVx = desiredVx - state.vx;

  // Velocity -> desired tilt. Tilt envelope shrinks near the ground.
  // Sign: positive `angle` leans the body in the +x direction, so its thrust
  // pushes +x. To accelerate toward `desiredVx`, the desired tilt must share
  // the sign of the velocity error.
  const maxTilt = (state.y > 50 ? 8 : state.y > 15 ? 4 : 2) * (Math.PI / 180);
  const desiredAngle = clamp(errorVx * 0.04, -maxTilt, maxTilt);

  // ---- Inner attitude PD --------------------------------------------------
  // Moderate gains so we don't oscillate against the high gimbal authority.
  const errorAngle = desiredAngle - state.angle;
  const gimbalCmd = clamp(
    -(errorAngle * 2.5 - state.angularVelocity * 2.0),
    -1,
    1,
  );

  // ---- Vertical descent profile ------------------------------------------
  // Suicide-burn target velocity: square-root profile that respects the
  // vehicle's *actual* available deceleration. Cap free-fall at 18 m/s so
  // we never accumulate more energy than the engine can shed.
  const yEff = Math.max(state.y - 1.5, 0);
  const sqrtTarget = -Math.sqrt(2 * safeDecel * yEff) - 0.5;
  let desiredVy = Math.max(sqrtTarget, -18);

  // Lateral health gate: don't dive at the pad while we're still way off
  // course. Slow descent (or briefly hover) until horizontal error is bounded.
  const lateralErr = Math.hypot(state.x, state.vx * 2);
  if (state.y > 40 && lateralErr > 15) {
    const factor = clamp(15 / lateralErr, 0.05, 1);
    desiredVy *= factor;
  }

  // Terminal flare: very gentle final touchdown.
  if (state.y < 8) desiredVy = Math.max(desiredVy, -2.5);
  if (state.y < 2) desiredVy = -0.8;
  if (state.y < 0.5) desiredVy = -0.4;

  const errorVy = desiredVy - state.vy;

  // Throttle: hover feed-forward + P on velocity error.
  // The P gain is large enough that any meaningful Vy error saturates the
  // throttle within ~one second, which is what we want for a soft touchdown.
  let throttleCmd = hoverThrottle + errorVy * 0.18;

  // Anti-windup: if we're descending much slower than target (or even climbing),
  // chop throttle so we re-acquire the descent profile quickly.
  if (state.vy > desiredVy + 4) throttleCmd = 0;

  throttleCmd = clamp(throttleCmd, 0, 1);
  if (state.fuel <= 0) throttleCmd = 0;

  return { throttle: throttleCmd, gimbal: gimbalCmd };
}
