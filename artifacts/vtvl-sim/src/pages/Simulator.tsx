import { useState } from 'react';
import { useSimulation } from '../hooks/useSimulation';
import { Sim2D } from '../components/Sim2D';
import { Sim3D } from '../components/Sim3D';
import { HUD } from '../components/HUD';
import { ControlPanel } from '../components/ControlPanel';
import { ModeToggle } from '../components/ModeToggle';
import { ScorePanel } from '../components/ScorePanel';
import { MissionConfig } from '../lib/physics';

function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

const HAS_WEBGL = detectWebGL();

interface SimulatorProps {
  mission: MissionConfig;
  onBackToMissions: () => void;
}

export default function Simulator({ mission, onBackToMissions }: SimulatorProps) {
  const {
    state,
    controls,
    setControls,
    launch,
    reset,
    autopilotEnabled,
    setAutopilotEnabled,
    fps,
    runResult,
  } = useSimulation(mission);

  const [mode, setMode] = useState<'2d' | '3d'>(HAS_WEBGL ? '3d' : '2d');

  const launchLabel = mission.startMode === 'launch' ? 'Launch' : 'Begin Descent';

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black selection:bg-amber-500/30">
      {/* Viewport */}
      {mode === '2d' ? (
        <Sim2D state={state} mission={mission} />
      ) : (
        <Sim3D state={state} mission={mission} />
      )}

      {/* Overlay UI */}
      <HUD state={state} mission={mission} />
      <ModeToggle mode={mode} setMode={setMode} />

      <ControlPanel
        controls={controls}
        setControls={setControls}
        launch={launch}
        reset={reset}
        autopilotEnabled={autopilotEnabled}
        setAutopilotEnabled={setAutopilotEnabled}
        status={state.status}
        launchLabel={launchLabel}
        onBackToMissions={onBackToMissions}
      />

      {/* Status Bar */}
      <div className="absolute bottom-2 right-4 flex items-center gap-4 text-[10px] font-mono text-slate-500">
        <div>FPS: <span className="text-slate-300">{fps}</span></div>
        <div>SYS: <span className="text-slate-300">{state.status.toUpperCase()}</span></div>
        <div>AP: <span className={autopilotEnabled ? "text-amber-400" : "text-slate-300"}>{autopilotEnabled ? 'ENGAGED' : 'STBY'}</span></div>
      </div>

      {/* End-of-run scoring overlay */}
      {runResult && (
        <ScorePanel
          result={runResult}
          mission={mission}
          onReset={reset}
          onBackToMissions={onBackToMissions}
        />
      )}
    </div>
  );
}
