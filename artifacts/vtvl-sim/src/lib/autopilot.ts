import { PhysicsState, Controls, CONSTANTS } from './physics';

export function computeAutopilotControls(state: PhysicsState): Controls {
  // If landed or crashed, kill throttle and center gimbal
  if (state.status === 'landed' || state.status === 'crashed') {
    return { throttle: 0, gimbal: 0 };
  }

  // PID state (simplified to P/PD for this)
  
  // 1. Outer Loop: Target x = 0 -> Desired Angle
  const targetX = 0;
  const errorX = targetX - state.x;
  
  // P control for position -> desired velocity
  const desiredVx = Math.min(10, Math.max(-10, errorX * 0.5));
  const errorVx = desiredVx - state.vx;
  
  // P control for velocity -> desired angle
  // Tilt to thrust sideways. Max tilt 15 degrees.
  const maxTilt = 15 * Math.PI / 180;
  let desiredAngle = -errorVx * 0.05; 
  desiredAngle = Math.min(maxTilt, Math.max(-maxTilt, desiredAngle));

  // 2. Inner Loop: Target Angle -> Gimbal
  const errorAngle = desiredAngle - state.angle;
  // PD control for angle -> gimbal command
  // P term for angle error, D term for angular velocity
  let gimbalCmd = -(errorAngle * 2.0 - state.angularVelocity * 1.5);
  gimbalCmd = Math.min(1, Math.max(-1, gimbalCmd));

  // 3. Vertical Loop: Target Descent Rate -> Throttle
  let desiredVy = 0;
  if (state.y > 100) {
    desiredVy = -30;
  } else if (state.y > 20) {
    desiredVy = -Math.sqrt(2 * 4 * state.y); // Suicide burn profile
  } else if (state.y > 5) {
    desiredVy = -5;
  } else {
    desiredVy = -2;
  }
  
  desiredVy = Math.max(-40, Math.min(-2, desiredVy));
  if (state.y < 0.5) desiredVy = -0.5; // Final touchdown

  const errorVy = desiredVy - state.vy;
  
  // Feed-forward throttle to hover:
  const mass = CONSTANTS.DRY_MASS + state.fuel;
  const hoverThrust = mass * CONSTANTS.GRAVITY;
  const hoverThrottle = hoverThrust / CONSTANTS.MAX_THRUST;
  
  // PI control for vertical velocity -> throttle
  let throttleCmd = hoverThrottle + errorVy * 0.05;
  
  if (state.y <= 0 && state.status === 'landed') {
    throttleCmd = 0;
  }

  throttleCmd = Math.min(1, Math.max(0, throttleCmd));

  return {
    throttle: throttleCmd,
    gimbal: gimbalCmd
  };
}
