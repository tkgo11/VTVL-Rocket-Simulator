import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, OrbitControls, Sparkles, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { PhysicsState, CONSTANTS } from '../lib/physics';

interface Sim3DProps {
  state: PhysicsState;
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

function CameraTracker({ state }: { state: PhysicsState }) {
  useFrame((sceneState) => {
    const targetX = state.x;
    const targetY = state.y + CONSTANTS.LENGTH / 2;
    
    // Smooth follow
    sceneState.camera.position.lerp(new THREE.Vector3(targetX + 60, targetY + 10, 60), 0.1);
    sceneState.camera.lookAt(targetX, targetY, 0);
  });
  return null;
}

export function Sim3D({ state }: Sim3DProps) {
  return (
    <div className="absolute inset-0 bg-[#060B19]">
      <Canvas shadows>
        <CameraTracker state={state} />
        
        <ambientLight intensity={0.2} />
        <directionalLight 
          position={[100, 100, 50]} 
          intensity={1} 
          castShadow 
          color="#fff5e6"
        />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        {/* Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        
        {/* Pad */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} receiveShadow>
          <circleGeometry args={[25, 32]} />
          <meshStandardMaterial color="#475569" />
        </mesh>

        <Rocket state={state} />
      </Canvas>
    </div>
  );
}
