import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { MissionConfig, PhysicsState, CONSTANTS } from '../../lib/physics';

// Minimal structural type for the OrbitControls instance we manipulate. Avoids
// pulling in the three-stdlib type package while still being precise about
// what we touch.
interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
}

export type CameraMode = 'tracking' | 'chase' | 'orbit';

interface CameraRigProps {
  mode: CameraMode;
  state: PhysicsState;
  mission: MissionConfig;
}

export function CameraRig({ mode, state, mission }: CameraRigProps) {
  const { camera } = useThree();
  // Reusable scratch vectors so we don't allocate every frame.
  const tmpTarget = useRef(new THREE.Vector3());
  const tmpDesired = useRef(new THREE.Vector3());
  const tmpLook = useRef(new THREE.Vector3());

  const orbitRef = useRef<OrbitControlsLike | null>(null);

  // When entering orbit mode, capture a desired starting pose; the per-frame
  // loop will then interpolate toward it for a smooth transition instead of
  // a hard cut. Once the camera is close enough we hand off to OrbitControls.
  const orbitEntry = useRef<{
    desiredPos: THREE.Vector3;
    desiredTarget: THREE.Vector3;
    settled: boolean;
  } | null>(null);

  useEffect(() => {
    if (mode === 'orbit') {
      const cx = state.x;
      const cy = state.y + CONSTANTS.LENGTH / 2;
      orbitEntry.current = {
        desiredPos: new THREE.Vector3(cx + 80, cy + 30, 80),
        desiredTarget: new THREE.Vector3(cx, cy, 0),
        settled: false,
      };
    } else {
      orbitEntry.current = null;
    }
    // We intentionally only re-run on mode change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useFrame(() => {
    const focusY = state.y + CONSTANTS.LENGTH / 2;

    if (mode === 'tracking') {
      const focusX = (state.x + mission.targetPadX) / 2;
      const lateralSpread = Math.abs(state.x - mission.targetPadX);
      const distance = 60 + lateralSpread * 0.6;
      tmpDesired.current.set(focusX + distance, focusY + 10, distance);
      camera.position.lerp(tmpDesired.current, 0.1);
      tmpLook.current.set(state.x, focusY, 0);
      camera.lookAt(tmpLook.current);
    } else if (mode === 'chase') {
      tmpDesired.current.set(state.x + 6, focusY + 8, 35);
      camera.position.lerp(tmpDesired.current, 0.12);
      tmpLook.current.set(state.x, focusY - 4, 0);
      camera.lookAt(tmpLook.current);
    } else if (mode === 'orbit' && orbitRef.current) {
      const controls = orbitRef.current;
      const entry = orbitEntry.current;

      if (entry && !entry.settled) {
        // Smoothly interpolate camera + target toward the orbit start pose.
        camera.position.lerp(entry.desiredPos, 0.15);
        controls.target.lerp(entry.desiredTarget, 0.2);
        const posClose = camera.position.distanceToSquared(entry.desiredPos) < 0.5;
        const tgtClose = controls.target.distanceToSquared(entry.desiredTarget) < 0.5;
        if (posClose && tgtClose) entry.settled = true;
        controls.update();
      } else {
        // Settled: keep the orbit target on the rocket so the user orbits
        // around the vehicle as it moves.
        tmpTarget.current.set(state.x, focusY, 0);
        controls.target.lerp(tmpTarget.current, 0.15);
        controls.update();
      }
    }
  });

  // Memoize the OrbitControls element so it isn't reconstructed every frame.
  const orbit = useMemo(() => {
    if (mode !== 'orbit') return null;
    return (
      <OrbitControls
        ref={orbitRef as unknown as React.Ref<never>}
        enableDamping
        dampingFactor={0.1}
        minDistance={25}
        maxDistance={400}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    );
  }, [mode]);

  return <>{orbit}</>;
}
