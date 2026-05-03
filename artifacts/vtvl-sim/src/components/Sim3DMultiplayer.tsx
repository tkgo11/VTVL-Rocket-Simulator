import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { MissionConfig, PhysicsState, VehicleConfig, DEFAULT_VEHICLE } from '../lib/physics';
import { getPlanetTheme } from './sim3d/theme';
import { Rocket } from './sim3d/Rocket';
import { Pad } from './sim3d/Pad';
import { Environment } from './sim3d/Environment';
import { CameraRig, CameraMode } from './sim3d/CameraRig';
import { GroundFX } from './sim3d/GroundFX';
import { RemoteRocket } from './sim3d/RemoteRocket';
import { RemotePlayer } from '../hooks/useMultiplayerSocket';

const REMOTE_COLORS = [
  '#3b82f6', '#22c55e', '#ec4899', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16',
];

interface Sim3DMultiplayerProps {
  state: PhysicsState;
  mission: MissionConfig;
  vehicle?: VehicleConfig;
  remotePlayers: RemotePlayer[];
  /** When false (spectator mode), the local rocket is not rendered. Default true. */
  showLocalRocket?: boolean;
  /** ID of the player whose rocket the camera currently follows (spectator mode). */
  focusedPlayerId?: string | null;
  /** Called when the spectator clicks a player to switch camera focus. */
  onFocusPlayer?: (playerId: string) => void;
}

const CAMERA_MODES: { id: CameraMode; label: string }[] = [
  { id: 'tracking', label: 'Tracking' },
  { id: 'chase', label: 'Chase' },
  { id: 'orbit', label: 'Orbit' },
];

export function Sim3DMultiplayer({
  state,
  mission,
  vehicle = DEFAULT_VEHICLE,
  remotePlayers,
  showLocalRocket = true,
  focusedPlayerId = null,
  onFocusPlayer,
}: Sim3DMultiplayerProps) {
  const theme = getPlanetTheme(mission);
  const [cameraMode, setCameraMode] = useState<CameraMode>('tracking');

  return (
    <div className="absolute inset-0" style={{ background: theme.background }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [60, 30, 60], fov: 50, near: 0.5, far: 5000 }}
      >
        <Environment theme={theme} />
        <CameraRig mode={cameraMode} state={state} mission={mission} />
        <Pad mission={mission} state={state} />
        <GroundFX state={state} mission={mission} theme={theme} />
        {showLocalRocket && <Rocket state={state} vehicle={vehicle} />}
        {remotePlayers.map((p, idx) =>
          p.rocketState ? (
            <RemoteRocket
              key={p.id}
              state={p.rocketState}
              color={REMOTE_COLORS[idx % REMOTE_COLORS.length]}
              displayName={p.displayName}
            />
          ) : null,
        )}
      </Canvas>

      {/* Remote player list — clickable when spectating to switch camera focus */}
      {remotePlayers.length > 0 && (
        <div className="absolute top-16 left-4 z-10 space-y-1">
          {remotePlayers.map((p, idx) => {
            const isFocused = focusedPlayerId === p.id;
            const clickable = !!onFocusPlayer;
            return (
              <button
                key={p.id}
                onClick={clickable ? () => onFocusPlayer!(p.id) : undefined}
                disabled={!clickable}
                title={clickable ? `Follow ${p.displayName}` : undefined}
                className={
                  'flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded transition-colors ' +
                  (clickable
                    ? isFocused
                      ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 cursor-pointer'
                      : 'hover:bg-slate-800/70 text-slate-300 cursor-pointer border border-transparent'
                    : 'text-slate-300 cursor-default border border-transparent')
                }
              >
                <span
                  className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                  style={{ backgroundColor: REMOTE_COLORS[idx % REMOTE_COLORS.length] }}
                />
                <span>{p.displayName}</span>
                {isFocused && <span className="text-amber-400 text-[10px] ml-0.5">▶</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Camera mode selector */}
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
