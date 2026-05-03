import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { MissionConfig, PhysicsState, VehicleConfig, DEFAULT_VEHICLE } from '../lib/physics';
import { getPlanetTheme } from './sim3d/theme';
import { Rocket } from './sim3d/Rocket';
import { Pad } from './sim3d/Pad';
import { Environment } from './sim3d/Environment';
import { CameraRig, CameraMode } from './sim3d/CameraRig';

interface Sim3DProps {
  state: PhysicsState;
  mission: MissionConfig;
  vehicle?: VehicleConfig;
}

const CAMERA_MODES: { id: CameraMode; label: string }[] = [
  { id: 'tracking', label: 'Tracking' },
  { id: 'chase', label: 'Chase' },
  { id: 'orbit', label: 'Orbit' },
];

export function Sim3D({ state, mission, vehicle = DEFAULT_VEHICLE }: Sim3DProps) {
  const theme = getPlanetTheme(mission);
  const [cameraMode, setCameraMode] = useState<CameraMode>('tracking');

  return (
    <div
      className="absolute inset-0"
      style={{ background: theme.background }}
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [60, 30, 60], fov: 50, near: 0.5, far: 5000 }}
      >
        <Environment theme={theme} />
        <CameraRig mode={cameraMode} state={state} mission={mission} />
        <Pad mission={mission} state={state} />
        <Rocket state={state} vehicle={vehicle} />
      </Canvas>

      {/* Camera mode selector. Placed bottom-left so it doesn't collide with
          the mode toggle, settings panel, and wind panel at the top-right,
          or the telemetry HUD at top-left. */}
      <div className="absolute bottom-4 left-4 z-20 flex gap-1 rounded-md bg-slate-900/75 p-1 backdrop-blur-sm border border-slate-700/60 shadow-lg">
        {CAMERA_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setCameraMode(m.id)}
            className={
              'px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider rounded-sm transition-colors ' +
              (cameraMode === m.id
                ? 'bg-amber-500 text-slate-900'
                : 'text-slate-300 hover:bg-slate-700/70')
            }
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
