import { useEffect, useMemo } from 'react';
import { Sky, Stars, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { PlanetTheme } from './theme';

interface EnvironmentProps {
  theme: PlanetTheme;
}

export function Environment({ theme }: EnvironmentProps) {
  const groundMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.ground,
        roughness: 0.95,
        metalness: 0.05,
      }),
    [theme.ground],
  );

  const farGroundMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.groundDeep,
        roughness: 1,
        metalness: 0,
      }),
    [theme.groundDeep],
  );

  useEffect(() => {
    return () => {
      groundMat.dispose();
      farGroundMat.dispose();
    };
  }, [groundMat, farGroundMat]);

  return (
    <>
      <fog attach="fog" args={[theme.fogColor, theme.fogNear, theme.fogFar]} />
      <color attach="background" args={[theme.background]} />

      <ambientLight intensity={theme.ambient} />
      <hemisphereLight
        args={[theme.hemisphereSky, theme.hemisphereGround, 0.55]}
      />
      <directionalLight
        position={[120, 180, 80]}
        intensity={theme.sunIntensity}
        color={theme.sun}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
      />

      {theme.hasSky && (
        <Sky
          distance={4500}
          sunPosition={[80, 12, 100]}
          inclination={0.49}
          azimuth={0.25}
          mieCoefficient={0.005}
          mieDirectionalG={0.85}
          rayleigh={theme.rayleigh}
          turbidity={theme.turbidity}
        />
      )}
      {theme.hasStars && (
        <Stars radius={300} depth={80} count={4000} factor={5} saturation={0} fade speed={1} />
      )}

      {/* Near ground (textured-feeling tinted plane) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        material={groundMat}
        receiveShadow
      >
        <planeGeometry args={[800, 800, 1, 1]} />
      </mesh>
      {/* Far ground (deeper tone for distance contrast) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        material={farGroundMat}
      >
        <planeGeometry args={[5000, 5000]} />
      </mesh>

      {/* Reference grid centered on the launch origin */}
      <Grid
        position={[0, 0.06, 0]}
        args={[400, 400]}
        cellSize={5}
        cellThickness={0.6}
        cellColor="#1e293b"
        sectionSize={25}
        sectionThickness={1.2}
        sectionColor="#f59e0b"
        fadeDistance={300}
        fadeStrength={1.2}
        infiniteGrid
      />
    </>
  );
}
