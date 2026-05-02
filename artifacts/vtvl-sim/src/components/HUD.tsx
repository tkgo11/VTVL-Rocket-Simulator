import { MissionConfig, PhysicsState, VehicleConfig, DEFAULT_VEHICLE } from '../lib/physics';

interface HUDProps {
  state: PhysicsState;
  mission: MissionConfig;
  vehicle?: VehicleConfig;
}

function formatNumber(num: number, decimals: number = 1): string {
  return num.toFixed(decimals).padStart(decimals > 0 ? 5 + decimals : 4, ' ');
}

export function HUD({ state, mission, vehicle = DEFAULT_VEHICLE }: HUDProps) {
  const isCrashed = state.status === 'crashed';
  const isLanded = state.status === 'landed';
  const padDeviation = state.x - mission.targetPadX;
  const showWind = mission.wind !== 0 || mission.windGust !== 0;

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2 p-4 rounded bg-black/60 border border-slate-800 text-slate-200 font-mono text-sm shadow-xl backdrop-blur-sm pointer-events-none w-64">
      <div className="flex justify-between items-center pb-2 mb-1 border-b border-slate-800">
        <div className="flex flex-col">
          <span className="text-slate-400 font-sans font-semibold tracking-wider text-xs uppercase">Telemetry</span>
          <span className="text-[10px] text-slate-500 tracking-wider uppercase">{mission.name}</span>
        </div>
        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          isCrashed ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
          isLanded ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
          'bg-amber-500/20 text-amber-400 border border-amber-500/50'
        }`}>
          {state.status}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="text-slate-500">ALT</div>
        <div className="text-right text-white">{formatNumber(state.y)} <span className="text-slate-500 text-xs">m</span></div>

        <div className="text-slate-500">V.VEL</div>
        <div className="text-right text-white">{formatNumber(state.vy)} <span className="text-slate-500 text-xs">m/s</span></div>

        <div className="text-slate-500">H.VEL</div>
        <div className="text-right text-white">{formatNumber(state.vx)} <span className="text-slate-500 text-xs">m/s</span></div>

        <div className="text-slate-500">TILT</div>
        <div className="text-right text-white">{formatNumber(state.angle * (180 / Math.PI))} <span className="text-slate-500 text-xs">°</span></div>

        <div className="text-slate-500">THRUST</div>
        <div className="text-right text-white">{formatNumber(state.throttle * 100, 0)} <span className="text-slate-500 text-xs">%</span></div>

        <div className="text-slate-500">GIMBAL</div>
        <div className="text-right text-white">{formatNumber(state.gimbal * vehicle.maxGimbalDeg, 1)} <span className="text-slate-500 text-xs">°</span></div>

        <div className="text-slate-500">FUEL</div>
        <div className="text-right text-white">{formatNumber(state.fuel, 0)} <span className="text-slate-500 text-xs">kg</span></div>

        <div className="text-slate-500">PAD&Delta;</div>
        <div className="text-right text-white">{formatNumber(padDeviation)} <span className="text-slate-500 text-xs">m</span></div>

        {showWind && (
          <>
            <div className="text-slate-500">WIND</div>
            <div className="text-right text-white">{formatNumber(state.windNow)} <span className="text-slate-500 text-xs">m/s</span></div>
          </>
        )}
      </div>

      {isCrashed && (
        <div className="mt-3 p-2 bg-red-950/50 border border-red-900/50 rounded text-red-400 text-center text-xs animate-pulse">
          VEHICLE DESTROYED
        </div>
      )}
      {isLanded && (
        <div className="mt-3 p-2 bg-green-950/50 border border-green-900/50 rounded text-green-400 text-center text-xs">
          VEHICLE SECURE
        </div>
      )}
    </div>
  );
}
