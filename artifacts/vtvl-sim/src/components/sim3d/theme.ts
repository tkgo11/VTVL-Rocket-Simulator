import { MissionConfig } from '../../lib/physics';

export interface PlanetTheme {
  ground: string;
  groundDeep: string;
  ambient: number;
  hemisphereSky: string;
  hemisphereGround: string;
  sun: string;
  sunIntensity: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  background: string;
  hasSky: boolean;
  hasStars: boolean;
  rayleigh: number;
  turbidity: number;
}

export function getPlanetTheme(mission: MissionConfig): PlanetTheme {
  if (mission.id === 'martian_touchdown') {
    return {
      ground: '#8a4a25',
      groundDeep: '#3a1a0a',
      ambient: 0.35,
      hemisphereSky: '#d6a07a',
      hemisphereGround: '#3a1a0a',
      sun: '#ffd0a0',
      sunIntensity: 0.9,
      fogColor: '#caa07a',
      fogNear: 200,
      fogFar: 900,
      background: '#3a1f10',
      hasSky: true,
      hasStars: false,
      rayleigh: 4,
      turbidity: 14,
    };
  }
  if (mission.id === 'lunar_whisper') {
    return {
      ground: '#4a4a55',
      groundDeep: '#101018',
      ambient: 0.08,
      hemisphereSky: '#1a1a28',
      hemisphereGround: '#080810',
      sun: '#ffffff',
      sunIntensity: 1.4,
      fogColor: '#000000',
      fogNear: 400,
      fogFar: 1200,
      background: '#000000',
      hasSky: false,
      hasStars: true,
      rayleigh: 0,
      turbidity: 0,
    };
  }
  return {
    ground: '#1e3a5f',
    groundDeep: '#060d1a',
    ambient: 0.3,
    hemisphereSky: '#88b8e8',
    hemisphereGround: '#1e293b',
    sun: '#fff5e6',
    sunIntensity: 1.1,
    fogColor: '#7896b8',
    fogNear: 300,
    fogFar: 1100,
    background: '#0c1830',
    hasSky: true,
    hasStars: true,
    rayleigh: 2,
    turbidity: 8,
  };
}
