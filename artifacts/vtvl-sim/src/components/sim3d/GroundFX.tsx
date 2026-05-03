import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { PhysicsState } from '../../lib/physics';
import { PlanetTheme } from './theme';

interface GroundFXProps {
  state: PhysicsState;
  theme: PlanetTheme;
}

const DUST_TRIGGER_ALT = 35; // metres above ground at which dust starts

/**
 * Ground interaction effects: a dust kick-up cloud that appears when the
 * engine is firing close to the ground, plus a persistent scorch decal at
 * the touchdown / crash point. All allocation-free in the frame loop.
 */
export function GroundFX({ state, theme }: GroundFXProps) {
  const groupRef = useRef<THREE.Group>(null);
  const dustMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const scorchRef = useRef<THREE.Mesh>(null);
  const scorchMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Per-planet dust tint.
  const dustColor = useMemo(() => {
    if (theme.ground.toLowerCase().startsWith('#8a4a25')) return '#caa07a'; // Mars
    if (theme.ground.toLowerCase().startsWith('#4a4a55')) return '#9aa0a8'; // Moon
    return '#c8b88a'; // Earth
  }, [theme.ground]);

  const dustMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: dustColor,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [dustColor],
  );
  dustMatRef.current = dustMat;

  const scorchMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#1a1208',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );
  scorchMatRef.current = scorchMat;

  useEffect(() => {
    return () => {
      dustMat.dispose();
      scorchMat.dispose();
    };
  }, [dustMat, scorchMat]);

  useFrame(() => {
    const g = groupRef.current;
    if (g) g.position.x = state.x;

    const isThrusting =
      state.throttle > 0 && state.status !== 'landed' && state.status !== 'crashed';
    // Fade dust in as the rocket gets close to the ground.
    const proximity = Math.max(0, 1 - state.y / DUST_TRIGGER_ALT);
    const dustOpacity = isThrusting ? proximity * (0.35 + state.throttle * 0.45) : 0;
    if (dustMatRef.current) dustMatRef.current.opacity = dustOpacity;

    // Scorch decal: invisible until touchdown/crash, then ramps in. Bigger
    // and darker on a crash than a soft landing.
    if (scorchMatRef.current && scorchRef.current) {
      if (state.status === 'crashed') {
        scorchMatRef.current.opacity = Math.min(0.85, scorchMatRef.current.opacity + 0.05);
        scorchRef.current.scale.setScalar(1.6);
      } else if (state.status === 'landed') {
        scorchMatRef.current.opacity = Math.min(0.55, scorchMatRef.current.opacity + 0.04);
        scorchRef.current.scale.setScalar(1.0);
      } else {
        scorchMatRef.current.opacity = 0;
      }
    }
  });

  const dustActive =
    state.y < DUST_TRIGGER_ALT &&
    state.throttle > 0 &&
    state.status !== 'landed' &&
    state.status !== 'crashed';

  const scorchActive = state.status === 'landed' || state.status === 'crashed';

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Soft dust ring — always mounted; opacity is what makes it visible
          so we don't trigger geometry churn. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]} material={dustMat}>
        <ringGeometry args={[1.5, 12, 32]} />
      </mesh>

      {/* Particle puff — only mounted when actually active to keep particle
          counts down during ascent. */}
      {dustActive && (
        <Sparkles
          position={[0, 1.5, 0]}
          count={80}
          scale={[14, 4, 14]}
          color={dustColor}
          size={12}
          speed={0.25}
          opacity={0.6}
        />
      )}

      {/* Persistent scorch decal at impact point. */}
      <mesh
        ref={scorchRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.18, 0]}
        material={scorchMat}
        visible={scorchActive || (scorchMatRef.current?.opacity ?? 0) > 0}
      >
        <ringGeometry args={[0, 6, 32]} />
      </mesh>
    </group>
  );
}
