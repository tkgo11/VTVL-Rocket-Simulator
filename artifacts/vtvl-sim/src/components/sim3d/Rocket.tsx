import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PhysicsState, VehicleConfig, CONSTANTS } from '../../lib/physics';
import { Plume } from './Plume';

interface RocketProps {
  state: PhysicsState;
  vehicle: VehicleConfig;
}

export function Rocket({ state, vehicle }: RocketProps) {
  const groupRef = useRef<THREE.Group>(null);
  const nozzleRef = useRef<THREE.Group>(null);
  const maxGimbalRad = vehicle.maxGimbalDeg * (Math.PI / 180);

  useFrame(() => {
    const g = groupRef.current;
    if (g) {
      g.position.set(state.x, state.y + CONSTANTS.LENGTH / 2, 0);
      g.rotation.z = -state.angle;
    }
    const n = nozzleRef.current;
    if (n) n.rotation.z = state.gimbal * maxGimbalRad;
  });

  const isThrusting =
    state.throttle > 0 && state.status !== 'landed' && state.status !== 'crashed';

  const R = CONSTANTS.DIAMETER / 2;
  const L = CONSTANTS.LENGTH;

  // Memoize materials so they're not re-created every render.
  const mats = useMemo(() => {
    return {
      hull: new THREE.MeshStandardMaterial({
        color: '#e8eef5',
        metalness: 0.55,
        roughness: 0.35,
      }),
      hullDark: new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        metalness: 0.7,
        roughness: 0.4,
      }),
      stripe: new THREE.MeshStandardMaterial({
        color: '#0f172a',
        metalness: 0.2,
        roughness: 0.7,
      }),
      nose: new THREE.MeshStandardMaterial({
        color: '#cbd5e1',
        metalness: 0.6,
        roughness: 0.3,
      }),
      fin: new THREE.MeshStandardMaterial({
        color: '#475569',
        metalness: 0.6,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
      bell: new THREE.MeshStandardMaterial({
        color: '#1e293b',
        metalness: 0.85,
        roughness: 0.25,
      }),
      bellInner: new THREE.MeshStandardMaterial({
        color: '#0a0a0e',
        metalness: 0.9,
        roughness: 0.2,
      }),
      window: new THREE.MeshStandardMaterial({
        color: '#0ea5e9',
        emissive: '#0ea5e9',
        emissiveIntensity: 0.4,
        metalness: 0.3,
        roughness: 0.1,
      }),
      leg: new THREE.MeshStandardMaterial({
        color: '#334155',
        metalness: 0.7,
        roughness: 0.4,
      }),
    };
  }, []);

  // Dispose materials on unmount to release GPU resources.
  useEffect(() => {
    return () => {
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [mats]);

  // Three landing legs, splayed at 120° around the body.
  const legAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];

  return (
    <group ref={groupRef}>
      {/* Main hull (lower section, slightly darker) */}
      <mesh position={[0, -L * 0.15, 0]} material={mats.hullDark} castShadow>
        <cylinderGeometry args={[R, R, L * 0.35, 32]} />
      </mesh>

      {/* Upper hull (lighter) */}
      <mesh position={[0, L * 0.175, 0]} material={mats.hull} castShadow>
        <cylinderGeometry args={[R, R, L * 0.65, 32]} />
      </mesh>

      {/* Black banding (paneling stripes) */}
      <mesh position={[0, L * 0.42, 0]} material={mats.stripe}>
        <cylinderGeometry args={[R * 1.005, R * 1.005, 0.4, 32]} />
      </mesh>
      <mesh position={[0, L * 0.05, 0]} material={mats.stripe}>
        <cylinderGeometry args={[R * 1.005, R * 1.005, 0.4, 32]} />
      </mesh>
      <mesh position={[0, -L * 0.32, 0]} material={mats.stripe}>
        <cylinderGeometry args={[R * 1.005, R * 1.005, 0.4, 32]} />
      </mesh>

      {/* Inter-stage ring */}
      <mesh position={[0, L * 0.005, 0]} material={mats.hullDark}>
        <cylinderGeometry args={[R * 1.02, R * 1.02, 0.6, 32]} />
      </mesh>

      {/* Cockpit/instrument window */}
      <mesh position={[0, L * 0.42, R * 0.95]} material={mats.window}>
        <boxGeometry args={[R * 0.6, 0.6, 0.12]} />
      </mesh>

      {/* Nose cone (taller, sleek) */}
      <mesh position={[0, L / 2 + 2.5, 0]} material={mats.nose} castShadow>
        <coneGeometry args={[R, 5, 32]} />
      </mesh>
      {/* Cone tip cap */}
      <mesh position={[0, L / 2 + 5, 0]} material={mats.hullDark}>
        <sphereGeometry args={[0.25, 12, 12]} />
      </mesh>

      {/* Grid fins (4, near the top) */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
        <group key={`fin-top-${i}`} position={[0, L * 0.36, 0]} rotation={[0, a, 0]}>
          <mesh position={[R + 0.7, 0, 0]} rotation={[0, 0, 0]} material={mats.fin} castShadow>
            <boxGeometry args={[1.4, 1.6, 0.2]} />
          </mesh>
        </group>
      ))}

      {/* Lower fixed fins (4 wider planar fins) */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
        <group
          key={`fin-bot-${i}`}
          position={[0, -L * 0.42, 0]}
          rotation={[0, a, 0]}
        >
          <mesh
            position={[R + 1.2, -1.2, 0]}
            rotation={[0, 0, -0.4]}
            material={mats.fin}
            castShadow
          >
            <boxGeometry args={[2.4, 4, 0.18]} />
          </mesh>
        </group>
      ))}

      {/* Landing legs (3) */}
      {legAngles.map((a, i) => (
        <group
          key={`leg-${i}`}
          position={[0, -L * 0.45, 0]}
          rotation={[0, a, 0]}
        >
          <mesh
            position={[R + 1.2, -1.5, 0]}
            rotation={[0, 0, -0.55]}
            material={mats.leg}
            castShadow
          >
            <cylinderGeometry args={[0.18, 0.18, 4, 8]} />
          </mesh>
          <mesh position={[R + 2.4, -3.4, 0]} material={mats.leg} castShadow>
            <cylinderGeometry args={[0.45, 0.45, 0.3, 12]} />
          </mesh>
        </group>
      ))}

      {/* Engine bell + plume group */}
      <group ref={nozzleRef} position={[0, -L / 2, 0]}>
        {/* Throat (narrow) */}
        <mesh position={[0, -0.3, 0]} material={mats.bell} castShadow>
          <cylinderGeometry args={[0.9, 1.2, 0.6, 24]} />
        </mesh>
        {/* Bell (flared) */}
        <mesh position={[0, -1.6, 0]} material={mats.bell} castShadow>
          <cylinderGeometry args={[1.2, 2.2, 2.0, 24, 1, true]} />
        </mesh>
        {/* Bell interior (dark) */}
        <mesh position={[0, -1.6, 0]} material={mats.bellInner}>
          <cylinderGeometry args={[1.15, 2.15, 1.95, 24, 1, true]} />
        </mesh>
        {/* Bell rim */}
        <mesh position={[0, -2.6, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.bell}>
          <torusGeometry args={[2.2, 0.12, 8, 24]} />
        </mesh>

        <Plume isThrusting={isThrusting} throttle={state.throttle} />
      </group>
    </group>
  );
}
