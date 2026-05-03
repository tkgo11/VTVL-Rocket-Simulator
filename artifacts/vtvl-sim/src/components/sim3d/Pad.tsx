import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { MissionConfig, PhysicsState } from '../../lib/physics';

interface PadProps {
  mission: MissionConfig;
  state: PhysicsState;
}

export function Pad({ mission, state }: PadProps) {
  const radius = mission.padRadius;

  const mats = useMemo(
    () => ({
      deck: new THREE.MeshStandardMaterial({
        color: '#3a4654',
        metalness: 0.6,
        roughness: 0.55,
      }),
      deckRim: new THREE.MeshStandardMaterial({
        color: '#1f2937',
        metalness: 0.7,
        roughness: 0.4,
      }),
      ringOuter: new THREE.MeshBasicMaterial({ color: '#f59e0b' }),
      ringMid: new THREE.MeshBasicMaterial({ color: '#fbbf24' }),
      crossH: new THREE.MeshBasicMaterial({ color: '#e2e8f0' }),
      lightOn: new THREE.MeshBasicMaterial({ color: '#fde68a' }),
    }),
    [],
  );

  useEffect(() => {
    return () => {
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [mats]);

  // Status ring color: amber while flying, green on landed, red on crashed.
  const statusColor =
    state.status === 'landed' ? '#22c55e' : state.status === 'crashed' ? '#ef4444' : '#f59e0b';
  const statusEmissive = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: statusColor,
        emissive: statusColor,
        emissiveIntensity: state.status === 'landed' || state.status === 'crashed' ? 1.6 : 0.4,
        toneMapped: false,
      }),
    [statusColor, state.status],
  );

  // Dispose the prior status material whenever a fresh one replaces it.
  useEffect(() => {
    return () => statusEmissive.dispose();
  }, [statusEmissive]);

  // Perimeter marker lights around the pad.
  const lightCount = 12;
  const lights = useMemo(() => {
    const arr: { x: number; z: number }[] = [];
    for (let i = 0; i < lightCount; i++) {
      const a = (i / lightCount) * Math.PI * 2;
      arr.push({ x: Math.cos(a) * (radius - 0.5), z: Math.sin(a) * (radius - 0.5) });
    }
    return arr;
  }, [radius]);

  return (
    <group position={[mission.targetPadX, 0, 0]}>
      {/* Deck plating disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} material={mats.deck} receiveShadow>
        <cylinderGeometry args={[radius, radius, 0.4, 48]} />
      </mesh>
      {/* Deck rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} material={mats.deckRim}>
        <ringGeometry args={[radius - 0.4, radius, 64]} />
      </mesh>

      {/* Concentric target rings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.27, 0]} material={mats.ringOuter}>
        <ringGeometry args={[radius * 0.85, radius * 0.92, 64]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.27, 0]} material={mats.ringMid}>
        <ringGeometry args={[radius * 0.45, radius * 0.5, 64]} />
      </mesh>

      {/* Crosshair */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.28, 0]} material={mats.crossH}>
        <planeGeometry args={[radius * 1.3, 0.3]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.28, 0]} material={mats.crossH}>
        <planeGeometry args={[radius * 1.3, 0.3]} />
      </mesh>

      {/* Status ring (color reflects flight state) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]} material={statusEmissive}>
        <ringGeometry args={[radius * 0.97, radius, 64]} />
      </mesh>

      {/* Perimeter marker lights */}
      {lights.map((p, i) => (
        <group key={`l-${i}`} position={[p.x, 0.5, p.z]}>
          <mesh material={mats.lightOn}>
            <sphereGeometry args={[0.3, 10, 10]} />
          </mesh>
          <pointLight color="#fde68a" intensity={0.5} distance={6} />
        </group>
      ))}
    </group>
  );
}
