import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Sparkles, Sky, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { MissionConfig, PhysicsState, CONSTANTS } from '../lib/physics';

interface Sim3DProps {
  state: PhysicsState;
  mission: MissionConfig;
}

function Rocket({ state }: { state: PhysicsState }) {
  const groupRef = useRef<THREE.Group>(null);
  const nozzleRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(state.x, state.y + CONSTANTS.LENGTH / 2, 0);
      groupRef.current.rotation.z = -state.angle;
    }
    if (nozzleRef.current) {
      nozzleRef.current.rotation.z = state.gimbal * CONSTANTS.MAX_GIMBAL_ANGLE;
    }
  });

  const isThrusting = state.throttle > 0 && state.status !== 'landed' && state.status !== 'crashed';

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[CONSTANTS.DIAMETER/2, CONSTANTS.DIAMETER/2, CONSTANTS.LENGTH, 32]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>

      {/* Nose cone */}
      <mesh position={[0, CONSTANTS.LENGTH/2 + 2, 0]}>
        <coneGeometry args={[CONSTANTS.DIAMETER/2, 4, 32]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>

      {/* Nozzle Group */}
      <group ref={nozzleRef} position={[0, -CONSTANTS.LENGTH/2, 0]}>
        <mesh position={[0, -1, 0]}>
          <cylinderGeometry args={[1.5, 2, 2, 16]} />
          <meshStandardMaterial color="#334155" />
        </mesh>

        {isThrusting && (
          <>
            <pointLight
              position={[0, -2, 0]}
              color="#f59e0b"
              intensity={state.throttle * 5}
              distance={100}
            />
            <Sparkles
              position={[0, -10, 0]}
              count={200}
              scale={[3, 20, 3]}
              color="#f59e0b"
              size={10}
              speed={0.4}
              opacity={state.throttle}
            />
          </>
        )}
      </group>
    </group>
  );
}

function CameraTracker({ state, mission }: { state: PhysicsState; mission: MissionConfig }) {
  useFrame((sceneState) => {
    // Aim the camera at the midpoint between the rocket and the target pad
    // so both stay framed during long crosswind translations.
    const focusX = (state.x + mission.targetPadX) / 2;
    const focusY = state.y + CONSTANTS.LENGTH / 2;
    const lateralSpread = Math.abs(state.x - mission.targetPadX);
    const distance = 60 + lateralSpread * 0.6;

    sceneState.camera.position.lerp(
      new THREE.Vector3(focusX + distance, focusY + 10, distance),
      0.1,
    );
    sceneState.camera.lookAt(state.x, focusY, 0);
  });
  return null;
}

function Pad({ mission }: { mission: MissionConfig }) {
  const radius = mission.padRadius;
  return (
    <group position={[mission.targetPadX, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} receiveShadow>
        <circleGeometry args={[radius, 32]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.11, 0]}>
        <ringGeometry args={[radius - 3, radius - 1, 64]} />
        <meshBasicMaterial color="#f59e0b" />
      </mesh>
    </group>
  );
}

interface PlanetTheme {
  ground: string;
  ambient: number;
  sun: string;
  hasSky: boolean;
  hasStars: boolean;
}

function getPlanetTheme(mission: MissionConfig): PlanetTheme {
  if (mission.id === 'martian_touchdown') {
    return { ground: '#5a2c14', ambient: 0.25, sun: '#ffd0a0', hasSky: true, hasStars: false };
  }
  if (mission.id === 'lunar_whisper') {
    return { ground: '#2a2a35', ambient: 0.05, sun: '#ffffff', hasSky: false, hasStars: true };
  }
  return { ground: '#0f172a', ambient: 0.2, sun: '#fff5e6', hasSky: true, hasStars: true };
}

export function Sim3D({ state, mission }: Sim3DProps) {
  const theme = getPlanetTheme(mission);

  return (
    <div
      className="absolute inset-0"
      style={{ background: theme.hasSky ? '#060B19' : '#000000' }}
    >
      <Canvas shadows>
        <CameraTracker state={state} mission={mission} />

        <ambientLight intensity={theme.ambient} />
        <directionalLight
          position={[100, 100, 50]}
          intensity={1}
          castShadow
          color={theme.sun}
        />

        {theme.hasSky && (
          <Sky
            distance={4500}
            sunPosition={[80, 12, 100]}
            inclination={0.49}
            azimuth={0.25}
            mieCoefficient={0.005}
            mieDirectionalG={0.85}
            rayleigh={mission.id === 'martian_touchdown' ? 4 : 2}
            turbidity={mission.id === 'martian_touchdown' ? 14 : 8}
          />
        )}
        {theme.hasStars && (
          <Stars radius={300} depth={80} count={4000} factor={5} saturation={0} fade speed={1} />
        )}

        {/* Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[2000, 2000]} />
          <meshStandardMaterial color={theme.ground} />
        </mesh>

        {/* Reference grid centered on the launch origin */}
        <Grid
          position={[0, 0.05, 0]}
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

        <Pad mission={mission} />

        <Rocket state={state} />
      </Canvas>
    </div>
  );
}
