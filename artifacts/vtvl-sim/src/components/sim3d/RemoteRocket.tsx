import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONSTANTS } from '../../lib/physics';
import { RocketState } from '../../hooks/useMultiplayerSocket';

interface RemoteRocketProps {
  state: RocketState;
  color: string;
  displayName: string;
}

export function RemoteRocket({ state, color, displayName: _displayName }: RemoteRocketProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Lerp toward the broadcasted state for smooth motion
  const lerpedPos = useRef({ x: state.x, y: state.y });
  const lerpedAngle = useRef(state.angle);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    const alpha = Math.min(1, delta * 15);
    lerpedPos.current.x += (state.x - lerpedPos.current.x) * alpha;
    lerpedPos.current.y += (state.y - lerpedPos.current.y) * alpha;
    lerpedAngle.current += (state.angle - lerpedAngle.current) * alpha;

    g.position.set(lerpedPos.current.x, lerpedPos.current.y + CONSTANTS.LENGTH / 2, 0);
    g.rotation.z = -lerpedAngle.current;
  });

  const R = CONSTANTS.DIAMETER / 2;
  const L = CONSTANTS.LENGTH;

  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.4,
    roughness: 0.5,
    transparent: true,
    opacity: 0.85,
  });

  const isThrusting = state.throttle > 0 && state.status !== 'landed' && state.status !== 'crashed';

  return (
    <group ref={groupRef}>
      {/* Hull */}
      <mesh material={mat} castShadow>
        <cylinderGeometry args={[R, R, L * 0.85, 16]} />
      </mesh>
      {/* Nose */}
      <mesh position={[0, L / 2 + 2, 0]} castShadow>
        <coneGeometry args={[R, 4, 16]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} transparent opacity={0.85} />
      </mesh>
      {/* Simple plume */}
      {isThrusting && (
        <mesh position={[0, -L / 2 - 2, 0]}>
          <coneGeometry args={[1.2, 4, 12]} />
          <meshStandardMaterial
            color="#ff8c00"
            emissive="#ff4400"
            emissiveIntensity={1.5}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}
    </group>
  );
}
