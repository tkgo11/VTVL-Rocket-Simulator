import { MissionConfig } from './physics';

export const MISSIONS: MissionConfig[] = [
  {
    id: 'standard_hop',
    name: 'Standard Hop',
    description:
      'A textbook flight from the Cape. Ignite, climb, recover. Calm air, full tanks.',
    difficulty: 'easy',
    startMode: 'launch',
    startAltitude: 200,
    fuel: 50000,
    targetPadX: 0,
    padRadius: 25,
    gravity: 9.81,
    wind: 0,
    windGust: 0,
    airDensity: 1.225,
  },
  {
    id: 'suborbital_hop',
    name: 'Suborbital Hop',
    description:
      '1.5km apex re-entry. Plenty of propellant, but a lot of altitude to bleed.',
    difficulty: 'medium',
    startMode: 'descent',
    startAltitude: 1500,
    fuel: 35000,
    targetPadX: 0,
    padRadius: 25,
    gravity: 9.81,
    wind: 2,
    windGust: 1,
    airDensity: 1.225,
  },
  {
    id: 'crosswind_droneship',
    name: 'Drone Ship Crosswind',
    description:
      'Translate downrange to the autonomous spaceport drone ship in a steady 10 m/s easterly. Tight pad.',
    difficulty: 'hard',
    startMode: 'descent',
    startAltitude: 450,
    fuel: 22000,
    targetPadX: 80,
    padRadius: 18,
    gravity: 9.81,
    wind: -10,
    windGust: 3,
    airDensity: 1.225,
  },
  {
    id: 'low_fuel',
    name: 'Low-Fuel Emergency',
    description:
      'Tanks vented after an anomaly. You have one suicide burn to make it home.',
    difficulty: 'hard',
    startMode: 'descent',
    startAltitude: 260,
    fuel: 6000,
    targetPadX: 0,
    padRadius: 25,
    gravity: 9.81,
    wind: 0,
    windGust: 0,
    airDensity: 1.225,
  },
  {
    id: 'lunar_whisper',
    name: 'Lunar Whisper',
    description:
      'No atmosphere, 1/6 g. Momentum bleeds slowly - a delicate touch is everything.',
    difficulty: 'medium',
    startMode: 'descent',
    startAltitude: 600,
    startVx: 4,
    fuel: 9000,
    targetPadX: -25,
    padRadius: 25,
    gravity: 1.62,
    wind: 0,
    windGust: 0,
    airDensity: 0,
  },
  {
    id: 'martian_touchdown',
    name: 'Martian Touchdown',
    description:
      'Thin Martian air, 0.38 g, dust devils gusting from the west. Land the science package.',
    difficulty: 'extreme',
    startMode: 'descent',
    startAltitude: 800,
    fuel: 11000,
    targetPadX: 60,
    padRadius: 20,
    gravity: 3.71,
    wind: 6,
    windGust: 4,
    airDensity: 0.02,
  },
];

export const DEFAULT_MISSION = MISSIONS[0];

export function getMission(id: string): MissionConfig {
  return MISSIONS.find((m) => m.id === id) ?? DEFAULT_MISSION;
}
