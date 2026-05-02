import { useMemo, useState } from 'react';
import { VehicleConfig, MissionConfig } from '../lib/physics';
import { VEHICLE_PRESETS, CUSTOM_VEHICLE_ID, getPresetById, detectPresetId } from '../lib/vehicles';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

interface SettingsPanelProps {
  vehicle: VehicleConfig;
  setVehicle: (v: VehicleConfig) => void;
  mission: MissionConfig;
  gravity: number;
  setGravity: (g: number) => void;
  defaultGravity: number;
}

interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

function ParamSlider({ label, value, min, max, step, unit, format, onChange }: ParamSliderProps) {
  const display = format ? format(value) : value.toLocaleString();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[11px] font-mono text-slate-400">
        <span className="uppercase tracking-wider">{label}</span>
        <span className="text-slate-200">
          {display}
          {unit && <span className="text-slate-500 ml-1">{unit}</span>}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="cursor-pointer"
      />
    </div>
  );
}

export function SettingsPanel({
  vehicle,
  setVehicle,
  mission,
  gravity,
  setGravity,
  defaultGravity,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);

  const activePresetId = useMemo(() => detectPresetId(vehicle), [vehicle]);

  const updateVehicle = (patch: Partial<VehicleConfig>) => {
    const merged = { ...vehicle, ...patch };
    const matched = detectPresetId(merged);
    setVehicle({
      ...merged,
      id: matched,
      name:
        matched === CUSTOM_VEHICLE_ID
          ? 'Custom'
          : (getPresetById(matched)?.name ?? merged.name),
    });
  };

  const applyPreset = (id: string) => {
    if (id === CUSTOM_VEHICLE_ID) {
      setVehicle({ ...vehicle, id: CUSTOM_VEHICLE_ID, name: 'Custom' });
      return;
    }
    const preset = getPresetById(id);
    if (preset) setVehicle({ ...preset });
  };

  const presetButtons: { id: string; name: string }[] = [
    ...VEHICLE_PRESETS.map((p) => ({ id: p.id, name: p.name })),
    { id: CUSTOM_VEHICLE_ID, name: 'Custom' },
  ];

  return (
    <div className="absolute top-4 right-4 z-30 w-80 max-w-[90vw] flex flex-col items-end gap-2 pointer-events-none">
      <div className="pointer-events-auto">
        <Button
          onClick={() => setOpen((o) => !o)}
          variant="outline"
          size="sm"
          className="bg-black/70 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white font-mono text-[11px] tracking-wider uppercase backdrop-blur-sm"
          data-testid="button-toggle-settings"
        >
          {open ? '× Settings' : '⚙ Vehicle Settings'}
        </Button>
      </div>

      {open && (
        <div className="pointer-events-auto w-full bg-black/85 border border-slate-800 rounded-xl p-4 shadow-2xl backdrop-blur-md max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-500/80">
                Vehicle Design
              </span>
              <span className="text-sm font-bold text-white">{vehicle.name}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-slate-200 text-lg leading-none px-1"
              aria-label="Close settings"
            >
              ×
            </button>
          </div>

          <div className="mb-4">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">
              Presets
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {presetButtons.map((p) => {
                const active = p.id === activePresetId;
                return (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    data-testid={`button-preset-${p.id}`}
                    className={`text-[11px] font-mono uppercase tracking-wider py-1.5 px-2 rounded border transition-colors ${
                      active
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <ParamSlider
              label="Dry Mass"
              value={vehicle.dryMass}
              min={500}
              max={200000}
              step={100}
              unit="kg"
              format={(v) => Math.round(v).toLocaleString()}
              onChange={(v) => updateVehicle({ dryMass: Math.round(v) })}
            />
            <ParamSlider
              label="Fuel Mass"
              value={vehicle.fuelMass}
              min={500}
              max={200000}
              step={100}
              unit="kg"
              format={(v) => Math.round(v).toLocaleString()}
              onChange={(v) => updateVehicle({ fuelMass: Math.round(v) })}
            />
            <ParamSlider
              label="Max Thrust"
              value={vehicle.maxThrust}
              min={20000}
              max={10000000}
              step={5000}
              unit="N"
              format={(v) =>
                v >= 1000000
                  ? `${(v / 1000000).toFixed(2)}M`
                  : `${Math.round(v / 1000)}k`
              }
              onChange={(v) => updateVehicle({ maxThrust: Math.round(v) })}
            />
            <ParamSlider
              label="Specific Impulse"
              value={vehicle.isp}
              min={150}
              max={450}
              step={1}
              unit="s"
              format={(v) => Math.round(v).toString()}
              onChange={(v) => updateVehicle({ isp: Math.round(v) })}
            />
            <ParamSlider
              label="Max Gimbal"
              value={vehicle.maxGimbalDeg}
              min={1}
              max={25}
              step={0.5}
              unit="°"
              format={(v) => v.toFixed(1)}
              onChange={(v) => updateVehicle({ maxGimbalDeg: Math.round(v * 2) / 2 })}
            />
            <ParamSlider
              label="Drag Coefficient"
              value={vehicle.dragCoef}
              min={0}
              max={2}
              step={0.05}
              format={(v) => v.toFixed(2)}
              onChange={(v) => updateVehicle({ dragCoef: Math.round(v * 100) / 100 })}
            />

            <div className="border-t border-slate-800 pt-3 mt-1">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">
                Environment ({mission.name})
              </div>
              <ParamSlider
                label="Gravity"
                value={gravity}
                min={0.1}
                max={25}
                step={0.01}
                unit="m/s²"
                format={(v) => v.toFixed(2)}
                onChange={(v) => setGravity(Math.round(v * 100) / 100)}
              />
            </div>

            <div className="border-t border-slate-800 pt-3 mt-1 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
              <div className="flex flex-col">
                <span className="uppercase tracking-wider">TWR</span>
                <span className="text-slate-200 font-bold">
                  {(
                    vehicle.maxThrust /
                    ((vehicle.dryMass + vehicle.fuelMass) * gravity)
                  ).toFixed(2)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="uppercase tracking-wider">Δv (vac)</span>
                <span className="text-slate-200 font-bold">
                  {Math.round(
                    vehicle.isp *
                      9.80665 *
                      Math.log(
                        (vehicle.dryMass + vehicle.fuelMass) / vehicle.dryMass,
                      ),
                  ).toLocaleString()}
                  <span className="text-slate-500 ml-1">m/s</span>
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setVehicle({ ...VEHICLE_PRESETS[0] });
                setGravity(defaultGravity);
              }}
              className="mt-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 hover:text-amber-300 self-end"
              data-testid="button-reset-vehicle"
            >
              Reset to defaults
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-600 leading-relaxed">
            Changes apply on the next launch. The simulator resets when you
            adjust a parameter.
          </div>
        </div>
      )}
    </div>
  );
}
