import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';

interface PlumeProps {
  isThrusting: boolean;
  throttle: number;
}

/**
 * Layered engine plume. Built from cheap primitives + a single Sparkles trail
 * so it stays performant even at full throttle.
 *
 *   - bright inner cone (additive, very small)
 *   - hot outer cone (additive, larger, scales with throttle)
 *   - flickering point light
 *   - particle exhaust trail (Sparkles)
 */
export function Plume({ isThrusting, throttle }: PlumeProps) {
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const mats = useMemo(
    () => ({
      inner: new THREE.MeshBasicMaterial({
        color: '#fff7d6',
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      outer: new THREE.MeshBasicMaterial({
        color: '#ff8a3d',
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [],
  );

  useEffect(() => {
    return () => {
      mats.inner.dispose();
      mats.outer.dispose();
    };
  }, [mats]);

  useFrame((_, dt) => {
    const flicker = 0.85 + Math.random() * 0.3;
    const t = isThrusting ? throttle : 0;
    if (innerRef.current) {
      const s = Math.max(0.001, 0.6 + t * 1.4) * flicker;
      innerRef.current.scale.set(s, Math.max(0.001, t * 5), s);
      innerRef.current.visible = t > 0;
    }
    if (outerRef.current) {
      const s = Math.max(0.001, 0.9 + t * 2.0) * flicker;
      outerRef.current.scale.set(s, Math.max(0.001, t * 8), s);
      outerRef.current.visible = t > 0;
    }
    if (lightRef.current) {
      lightRef.current.intensity = t * 8 * flicker;
      lightRef.current.visible = t > 0;
    }
    // touch dt to keep linter quiet
    void dt;
  });

  if (!isThrusting && throttle <= 0) return null;

  return (
    <group position={[0, -3.5, 0]}>
      {/* outer hot cone */}
      <mesh ref={outerRef} material={mats.outer} position={[0, -1, 0]}>
        <coneGeometry args={[1.0, 1.0, 24, 1, true]} />
      </mesh>
      {/* bright inner core */}
      <mesh ref={innerRef} material={mats.inner} position={[0, -0.5, 0]}>
        <coneGeometry args={[0.4, 1.0, 18, 1, true]} />
      </mesh>
      {/* flickering engine light */}
      <pointLight
        ref={lightRef}
        position={[0, -1, 0]}
        color="#ffb060"
        distance={140}
        decay={2}
      />
      {/* particle exhaust trail */}
      <Sparkles
        position={[0, -10, 0]}
        count={140}
        scale={[2.5, 22, 2.5]}
        color="#ffb060"
        size={8}
        speed={0.5}
        opacity={Math.min(1, throttle + 0.1)}
      />
    </group>
  );
}
