import { VehicleConfig, DEFAULT_VEHICLE } from './physics';

/**
 * Hand-tuned vehicle presets. Numbers are loosely faithful to public specs
 * but rounded for legibility — the goal is for each preset to feel
 * meaningfully different to fly, not to be a precise simulator of a real
 * rocket.
 *
 * The "custom" preset is just a snapshot the user lands on whenever they
 * edit a slider — it lives in the panel state, not here.
 */
export const VEHICLE_PRESETS: VehicleConfig[] = [
  // Default Falcon 9-ish booster — matches the previously baked-in constants.
  DEFAULT_VEHICLE,
  {
    id: 'starship_hop',
    name: 'Starship Hop',
    dryMass: 120000,
    fuelMass: 110000,
    maxThrust: 7400000,
    isp: 330,
    maxGimbalDeg: 10,
    dragCoef: 0.7,
  },
  {
    id: 'lunar_lander',
    name: 'Lunar Lander',
    dryMass: 2200,
    fuelMass: 8200,
    maxThrust: 45000,
    isp: 311,
    maxGimbalDeg: 6,
    dragCoef: 1.2,
  },
];

export const CUSTOM_VEHICLE_ID = 'custom';

export function getPresetById(id: string): VehicleConfig | undefined {
  return VEHICLE_PRESETS.find((v) => v.id === id);
}

/**
 * Compare a config against the named presets. Returns the matching preset id,
 * or `CUSTOM_VEHICLE_ID` if the user has dialled in their own values.
 */
export function detectPresetId(vehicle: VehicleConfig): string {
  for (const p of VEHICLE_PRESETS) {
    if (
      p.dryMass === vehicle.dryMass &&
      p.fuelMass === vehicle.fuelMass &&
      p.maxThrust === vehicle.maxThrust &&
      p.isp === vehicle.isp &&
      p.maxGimbalDeg === vehicle.maxGimbalDeg &&
      p.dragCoef === vehicle.dragCoef
    ) {
      return p.id;
    }
  }
  return CUSTOM_VEHICLE_ID;
}
