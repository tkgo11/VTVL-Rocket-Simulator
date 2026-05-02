import React, { useState } from 'react';
import { useSimulation } from '../hooks/useSimulation';
import { Sim2D } from '../components/Sim2D';
import { Sim3D } from '../components/Sim3D';
import { HUD } from '../components/HUD';
import { ControlPanel } from '../components/ControlPanel';
import { ModeToggle } from '../components/ModeToggle';

export default function Simulator() {
  const { 
    state, 
    controls, 
    setControls, 
    launch, 
    reset, 
    autopilotEnabled, 
    setAutopilotEnabled,
    fps 
  } = useSimulation();

  const [mode, setMode] = useState<'2d' | '3d'>('3d');

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black selection:bg-amber-500/30">
      {/* Viewport */}
      {mode === '2d' ? (
        <Sim2D state={state} />
      ) : (
        <Sim3D state={state} />
      )}

      {/* Overlay UI */}
      <HUD state={state} />
      <ModeToggle mode={mode} setMode={setMode} />
      
      <ControlPanel 
        controls={controls}
        setControls={setControls}
        launch={launch}
        reset={reset}
        autopilotEnabled={autopilotEnabled}
        setAutopilotEnabled={setAutopilotEnabled}
        status={state.status}
      />

      {/* Status Bar */}
      <div className="absolute bottom-2 right-4 flex items-center gap-4 text-[10px] font-mono text-slate-500">
        <div>FPS: <span className="text-slate-300">{fps}</span></div>
        <div>SYS: <span className="text-slate-300">{state.status.toUpperCase()}</span></div>
        <div>AP: <span className={autopilotEnabled ? "text-amber-400" : "text-slate-300"}>{autopilotEnabled ? 'ENGAGED' : 'STBY'}</span></div>
      </div>

      {/* End State Overlays */}
      {state.status === 'crashed' && (
        <div className="absolute inset-0 bg-red-950/40 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/80 border border-red-900 p-8 rounded-xl text-center shadow-2xl pointer-events-auto">
            <h2 className="text-red-500 text-3xl font-bold tracking-widest mb-2 font-mono">MISSION FAILURE</h2>
            <p className="text-red-200/70 mb-6 font-mono text-sm">Vehicle lost upon impact.</p>
            <div className="text-left font-mono text-sm text-slate-300 bg-black/50 p-4 rounded border border-slate-800 mb-6">
              <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                <span>Impact Vel:</span>
                <span className="text-red-400">{state.vy.toFixed(1)} m/s</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                <span>Impact Angle:</span>
                <span className="text-red-400">{(state.angle * (180/Math.PI)).toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span>H.Offset:</span>
                <span className="text-red-400">{Math.abs(state.x).toFixed(1)} m</span>
              </div>
            </div>
            <p className="text-slate-500 font-mono text-xs mt-4">Press 'R' or use Control Panel to restart</p>
          </div>
        </div>
      )}

      {state.status === 'landed' && (
        <div className="absolute inset-0 bg-green-950/20 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/80 border border-green-900 p-8 rounded-xl text-center shadow-2xl pointer-events-auto">
            <h2 className="text-green-500 text-3xl font-bold tracking-widest mb-2 font-mono">VEHICLE SECURE</h2>
            <p className="text-green-200/70 mb-6 font-mono text-sm">Successful landing sequence completed.</p>
            <div className="text-left font-mono text-sm text-slate-300 bg-black/50 p-4 rounded border border-slate-800 mb-6">
              <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                <span>Touchdown Vel:</span>
                <span className="text-green-400">{state.vy.toFixed(1)} m/s</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                <span>Pad Deviation:</span>
                <span className="text-green-400">{Math.abs(state.x).toFixed(1)} m</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                <span>Fuel Remainder:</span>
                <span className="text-green-400">{state.fuel.toFixed(0)} kg</span>
              </div>
              <div className="flex justify-between">
                <span>Final Tilt:</span>
                <span className="text-green-400">{(state.angle * (180/Math.PI)).toFixed(1)}°</span>
              </div>
            </div>
            <p className="text-slate-500 font-mono text-xs mt-4">Press 'R' or use Control Panel to restart</p>
          </div>
        </div>
      )}
    </div>
  );
}
