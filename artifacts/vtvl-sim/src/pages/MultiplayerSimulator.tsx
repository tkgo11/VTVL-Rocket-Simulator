import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSimulation } from '../hooks/useSimulation';
import { useIsMobile } from '../hooks/useIsMobile';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { Sim2D } from '../components/Sim2D';
import { Sim3DMultiplayer } from '../components/Sim3DMultiplayer';
import { HUD } from '../components/HUD';
import { ControlPanel } from '../components/ControlPanel';
import { TouchControls } from '../components/TouchControls';
import { ModeToggle } from '../components/ModeToggle';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { UseMultiplayerSocketReturn } from '../hooks/useMultiplayerSocket';
import { getMission } from '../lib/missions';
import { DEFAULT_VEHICLE } from '../lib/physics';
import { api } from '../lib/api';
import { usePlayer } from '../contexts/PlayerContext';
import { Button } from '../components/ui/button';
import { GRADE_COLORS, Grade } from '../lib/scoring';

function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch { return false; }
}
const HAS_WEBGL = detectWebGL();

const BROADCAST_HZ = 10;

interface Props {
  missionId: string;
  seed: number;
  mp: UseMultiplayerSocketReturn;
  myId: string | null;
  role: 'player' | 'spectator';
  displayName: string;
  onLeave: () => void;
}

export default function MultiplayerSimulator({ missionId, seed, mp, myId, role, displayName: _displayName, onLeave }: Props) {
  const { player } = usePlayer();
  const isMobile = useIsMobile();
  const baseMission = getMission(missionId);
  // Spectators are locked to 3D so they always see live remote rockets.
  // Players get the normal WebGL-aware default.
  const [mode, setMode] = useState<'2d' | '3d'>(
    role === 'spectator' || HAS_WEBGL ? '3d' : '2d',
  );
  const [resultSubmitted, setResultSubmitted] = useState(false);
  const lastBroadcastRef = useRef(0);

  // Apply seed as a wind phase offset so all clients share identical gust pattern.
  // Convert seed (ms timestamp) to a radians offset in [0, 2π).
  const mission = useMemo(() => ({
    ...baseMission,
    windPhase: (seed % 6283) / 1000, // 6283 ≈ 2π * 1000
  }), [baseMission, seed]);

  const {
    state, controls, setControls, launch, reset,
    autopilotEnabled, setAutopilotEnabled, fps,
    runResult, mission: effectiveMission,
  } = useSimulation(mission, DEFAULT_VEHICLE);

  useKeyboardControls({
    controls, setControls, reset, autopilotEnabled, setAutopilotEnabled,
    status: state.status, onBackToMissions: onLeave, enabled: role === 'player',
  });

  // Broadcast rocket state at BROADCAST_HZ
  useEffect(() => {
    if (role !== 'player') return;
    const interval = setInterval(() => {
      if (state.status === 'armed') return;
      const now = Date.now();
      if (now - lastBroadcastRef.current < 1000 / BROADCAST_HZ) return;
      lastBroadcastRef.current = now;
      mp.sendRocketState({
        x: state.x, y: state.y, vx: state.vx, vy: state.vy,
        angle: state.angle, angularVelocity: state.angularVelocity,
        throttle: state.throttle, gimbal: state.gimbal,
        fuel: state.fuel, status: state.status, t: state.t,
      });
    }, 50);
    return () => clearInterval(interval);
  }, [role, mp, state]);

  // Submit result when flight ends
  useEffect(() => {
    if (!runResult || resultSubmitted || role !== 'player') return;
    setResultSubmitted(true);
    mp.submitResult(runResult.score.total, runResult.score.grade, runResult.score.crashed);
    // Also submit to global leaderboard (clientRunId ensures idempotency on retry)
    api.runs.submit({
      clientRunId: `mp-${myId ?? 'guest'}-${seed}-${missionId}`,
      missionId,
      guestName: player?.displayName,
      score: runResult.score.total,
      grade: runResult.score.grade,
      crashed: runResult.score.crashed,
      touchdownSpeed: runResult.score.metrics.touchdownSpeed,
      padDeviation: runResult.score.metrics.padDeviation,
      fuelRemaining: runResult.score.metrics.fuelRemaining,
      tiltDeg: runResult.score.metrics.tiltDeg,
      flightDuration: state.t,
    }, player?.token).catch(() => {});
  }, [runResult, resultSubmitted, role, mp, missionId, player, state.t]);

  const launchLabel = effectiveMission.startMode === 'launch' ? 'Launch' : 'Begin Descent';

  const remotePlayers = Array.from(mp.remotePlayers.values())
    .filter((p) => p.id !== myId && p.role === 'player' && p.rocketState);

  // Spectator target: which player's rocket the camera follows.
  // null = auto (follow first active player).
  const [spectatorFocusId, setSpectatorFocusId] = useState<string | null>(null);

  // If the focused player disappears, fall back to auto.
  useEffect(() => {
    if (!spectatorFocusId) return;
    const still = remotePlayers.some((p) => p.id === spectatorFocusId);
    if (!still) setSpectatorFocusId(null);
  }, [remotePlayers, spectatorFocusId]);

  // Resolve the state the camera should follow for spectators.
  const focusedRemoteState = remotePlayers.find((p) => p.id === (spectatorFocusId ?? remotePlayers[0]?.id))?.rocketState ?? null;
  // Cast is safe: CameraRig only reads x/y/angle/status, all present in RocketState.
  const cameraState = (role === 'spectator' && focusedRemoteState ? focusedRemoteState : state) as typeof state;

  const handleReset = useCallback(() => {
    reset();
    setResultSubmitted(false);
  }, [reset]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Viewport — spectators see remote rockets only, no local rocket artifact */}
      {mode === '2d' ? (
        role === 'player' ? (
          <Sim2D state={state} mission={effectiveMission} vehicle={DEFAULT_VEHICLE} />
        ) : (
          // Spectator in 2D: plain background with remote player labels below.
          <div className="absolute inset-0 bg-slate-950" />
        )
      ) : (
        <Sim3DMultiplayer
          state={cameraState}
          mission={effectiveMission}
          vehicle={DEFAULT_VEHICLE}
          remotePlayers={remotePlayers}
          showLocalRocket={role === 'player'}
          focusedPlayerId={role === 'spectator' ? (spectatorFocusId ?? remotePlayers[0]?.id ?? null) : null}
          onFocusPlayer={role === 'spectator' ? setSpectatorFocusId : undefined}
        />
      )}

      {/* HUD */}
      {role === 'player' && (
        <HUD state={state} mission={effectiveMission} vehicle={DEFAULT_VEHICLE} compact={isMobile} />
      )}

      {/* Top-right controls — ModeToggle hidden for spectators (locked to 3D) */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <ConnectionIndicator status={mp.status} />
        {role === 'player' && <ModeToggle mode={mode} setMode={setMode} />}
      </div>

      {/* Control panel — wind override is intentionally absent in multiplayer
          so all clients share the same mission wind defined by the room. */}
      {role === 'player' && (
        isMobile ? (
          <TouchControls
            controls={controls} setControls={setControls}
            launch={launch} reset={handleReset}
            autopilotEnabled={autopilotEnabled} setAutopilotEnabled={setAutopilotEnabled}
            status={state.status} launchLabel={launchLabel} onBackToMissions={onLeave}
          />
        ) : (
          <ControlPanel
            controls={controls} setControls={setControls}
            launch={launch} reset={handleReset}
            autopilotEnabled={autopilotEnabled} setAutopilotEnabled={setAutopilotEnabled}
            status={state.status} launchLabel={launchLabel} onBackToMissions={onLeave}
            maxGimbalDeg={DEFAULT_VEHICLE.maxGimbalDeg}
          />
        )
      )}

      {/* Spectator mode overlay */}
      {role === 'spectator' && (
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
          <div className="bg-slate-900/80 border border-slate-700 rounded-md px-3 py-2 text-xs font-mono text-slate-300 uppercase tracking-wider">
            Spectating
          </div>
          <Button onClick={onLeave} size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:text-white text-xs">
            Leave Room
          </Button>
        </div>
      )}

      {/* Remote player scores (versus) */}
      {mp.room?.type === 'versus' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 flex-wrap justify-center max-w-lg">
          {Array.from(mp.remotePlayers.values())
            .filter((p) => p.role === 'player')
            .map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono ${
                  p.id === myId
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                    : 'border-slate-700 bg-slate-900/80 text-slate-300'
                }`}
              >
                <span className="font-medium">{p.displayName}</span>
                {p.finished && (
                  <>
                    <span className="text-slate-500">·</span>
                    <span className={p.crashed ? 'text-red-400' : (GRADE_COLORS[p.grade as Grade] ?? 'text-slate-400')}>
                      {p.crashed ? 'CRASH' : `${p.grade} ${p.score}`}
                    </span>
                  </>
                )}
              </div>
            ))}
        </div>
      )}

      {/* FPS + status bar */}
      {!isMobile && (
        <div className="absolute bottom-2 right-4 flex items-center gap-4 text-[10px] font-mono text-slate-500 z-10">
          <div>FPS: <span className="text-slate-300">{fps}</span></div>
          <div>SYS: <span className="text-slate-300">{state.status.toUpperCase()}</span></div>
          <div>AP: <span className={autopilotEnabled ? 'text-amber-400' : 'text-slate-300'}>{autopilotEnabled ? 'ENGAGED' : 'STBY'}</span></div>
          <div>NET: <span className={mp.status === 'connected' ? 'text-emerald-400' : 'text-red-400'}>{mp.status.toUpperCase()}</span></div>
        </div>
      )}
    </div>
  );
}
