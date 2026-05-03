import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { MissionConfig, PhysicsState } from '../../lib/physics';
import { PlanetTheme } from './theme';

interface GroundFXProps {
  state: PhysicsState;
  mission: MissionConfig;
  theme: PlanetTheme;
}

// Altitude (m) below which the engine plume starts kicking up dust.
const DUST_TRIGGER_ALT = 30;

/**
 * Ground interaction effects:
 *   - A swirling dust ring + particle puff under the engine bell while the
 *     rocket is thrusting close to the surface.
 *   - A persistent scorch decal that fades in after touchdown (smaller / on
 *     the pad) or after a crash (larger, darker, on the surrounding ground).
 *
 * The scorch x is captured at the *moment* of impact and then frozen, so it
 * stays put even if the rocket slides or the state.x value drifts.
 */
export function GroundFX({ state, mission, theme }: GroundFXProps) {
  const dustGroupRef = useRef<THREE.Group>(null);
  const dustRingRef = useRef<THREE.Mesh>(null);
  const dustMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  const padScorchMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const crashScorchGroupRef = useRef<THREE.Group>(null);
  const crashScorchMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // Captured x of impact — null until the rocket lands or crashes.
  const impactXRef = useRef<number | null>(null);
  // Whether the impact was on the pad (vs. surrounding ground).
  const impactOnPadRef = useRef(false);

  const dustMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: theme.dust,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [theme.dust],
  );
  dustMatRef.current = dustMat;

  const padScorchMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#1a120a',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );
  padScorchMatRef.current = padScorchMat;

  const crashScorchMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#0d0805',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );
  crashScorchMatRef.current = crashScorchMat;

  useEffect(() => {
    return () => {
      dustMat.dispose();
      padScorchMat.dispose();
      crashScorchMat.dispose();
    };
  }, [dustMat, padScorchMat, crashScorchMat]);

  // Reset captured impact location + scorch fade-ins on every fresh run.
  // We trigger on (mission.id, status === 'armed') so that:
  //   * switching missions clears prior scorch;
  //   * resetting/relaunching the SAME mission also clears it (the sim
  //     drops back to 'armed' between runs, which is the canonical
  //     "new run" signal).
  const isArmed = state.status === 'armed';
  useEffect(() => {
    if (!isArmed) return;
    impactXRef.current = null;
    impactOnPadRef.current = false;
    if (padScorchMatRef.current) padScorchMatRef.current.opacity = 0;
    if (crashScorchMatRef.current) crashScorchMatRef.current.opacity = 0;
  }, [mission.id, isArmed]);

  useFrame(() => {
    // Dust group follows the rocket's x while in flight.
    if (dustGroupRef.current) dustGroupRef.current.position.x = state.x;

    const isAirborne = state.status !== 'landed' && state.status !== 'crashed';
    const isThrusting = state.throttle > 0 && isAirborne;

    // Fade dust in as we get close to the ground; scale with throttle so a
    // pinned-throttle suicide burn looks heavier than a feathered descent.
    const proximity = Math.max(0, 1 - state.y / DUST_TRIGGER_ALT);
    const dustOpacity = isThrusting ? proximity * (0.3 + state.throttle * 0.5) : 0;
    if (dustMatRef.current) dustMatRef.current.opacity = dustOpacity;

    // Subtle "swirl" — slowly rotate the dust ring while it's visible.
    if (dustRingRef.current && dustOpacity > 0.01) {
      dustRingRef.current.rotation.z += 0.01 + state.throttle * 0.02;
      // Slight pulsing scale so it doesn't look like a static decal.
      const s = 1 + Math.sin(state.t * 4) * 0.05 * proximity;
      dustRingRef.current.scale.set(s, s, 1);
    }

    // Capture impact location once, the first frame after touchdown/crash.
    if (!isAirborne && impactXRef.current === null) {
      impactXRef.current = state.x;
      impactOnPadRef.current = Math.abs(state.x - mission.targetPadX) <= mission.padRadius;
      if (crashScorchGroupRef.current && state.status === 'crashed') {
        crashScorchGroupRef.current.position.x = state.x;
      }
    }

    // Scorch fade-ins. Pad scorch only shows on a successful landing on the
    // pad; crash scorch shows on the ground at the impact x for crashes (and
    // for the rare "landed but off the pad" outcome).
    if (state.status === 'landed' && impactOnPadRef.current && padScorchMatRef.current) {
      padScorchMatRef.current.opacity = Math.min(0.5, padScorchMatRef.current.opacity + 0.04);
    }
    if (
      (state.status === 'crashed' ||
        (state.status === 'landed' && !impactOnPadRef.current)) &&
      crashScorchMatRef.current
    ) {
      const target = state.status === 'crashed' ? 0.85 : 0.45;
      crashScorchMatRef.current.opacity = Math.min(
        target,
        crashScorchMatRef.current.opacity + 0.05,
      );
    }
  });

  // Mount the particle puff only while it should be visible — keeps the
  // particle count down during ascent / cruise.
  const dustActive =
    state.y < DUST_TRIGGER_ALT &&
    state.throttle > 0.05 &&
    state.status !== 'landed' &&
    state.status !== 'crashed';

  const showCrashScorch =
    state.status === 'crashed' || (state.status === 'landed' && !impactOnPadRef.current);
  const crashScale = state.status === 'crashed' ? 1.6 : 1.0;

  return (
    <>
      {/* Live dust kick-up, pinned to the rocket's x. */}
      <group ref={dustGroupRef}>
        <mesh
          ref={dustRingRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.22, 0]}
          material={dustMat}
        >
          <ringGeometry args={[1.2, 11, 40]} />
        </mesh>
        {dustActive && (
          <Sparkles
            position={[0, 1.2, 0]}
            count={70}
            scale={[14, 3, 14]}
            color={theme.dust}
            size={14}
            speed={0.3}
            opacity={0.55}
          />
        )}
      </group>

      {/* Pad scorch — sits on TOP of the deck (deck top ≈ y=0.25). */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[mission.targetPadX, 0.29, 0]}
        material={padScorchMat}
      >
        <ringGeometry args={[0, mission.padRadius * 0.6, 40]} />
      </mesh>

      {/* Crash scorch — sits on the ground at the captured impact x. */}
      <group
        ref={crashScorchGroupRef}
        position={[impactXRef.current ?? 0, 0, 0]}
        visible={showCrashScorch}
        scale={[crashScale, crashScale, 1]}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} material={crashScorchMat}>
          <ringGeometry args={[0, 7, 48]} />
        </mesh>
      </group>
    </>
  );
}
