import { Grade, ScoreResult } from './scoring';

const STORAGE_PREFIX = 'vtvl_leaderboard_v1_';

export interface LeaderboardEntry {
  score: number;
  grade: Grade;
  touchdownSpeed: number;
  padDeviation: number;
  fuelRemaining: number;
  tiltDeg: number;
  date: string;
}

function key(missionId: string): string {
  return STORAGE_PREFIX + missionId;
}

function safeParse(raw: string | null): LeaderboardEntry | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof parsed.score !== 'number') return null;
    return parsed as LeaderboardEntry;
  } catch {
    return null;
  }
}

export function getBest(missionId: string): LeaderboardEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    return safeParse(window.localStorage.getItem(key(missionId)));
  } catch {
    return null;
  }
}

/**
 * Save the result if it is a successful landing AND improves on the previous
 * best. Crashes are never persisted as a personal best, even if there is no
 * existing record - players expect their PB to reflect a real landing.
 *
 * Returns the entry that should be displayed as the current best (which may
 * be null if the player has never landed this mission), and a flag indicating
 * whether this run set a new record.
 */
export function recordResult(
  missionId: string,
  result: ScoreResult,
): { entry: LeaderboardEntry | null; isNewBest: boolean; previous: LeaderboardEntry | null } {
  const previous = getBest(missionId);

  if (result.crashed) {
    return { entry: previous, isNewBest: false, previous };
  }

  const candidate: LeaderboardEntry = {
    score: result.total,
    grade: result.grade,
    touchdownSpeed: result.metrics.touchdownSpeed,
    padDeviation: result.metrics.padDeviation,
    fuelRemaining: result.metrics.fuelRemaining,
    tiltDeg: result.metrics.tiltDeg,
    date: new Date().toISOString(),
  };

  const isNewBest = !previous || candidate.score > previous.score;

  if (isNewBest && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key(missionId), JSON.stringify(candidate));
    } catch {
      // ignore (private mode, full storage, etc.)
    }
  }

  return { entry: isNewBest ? candidate : previous, isNewBest, previous };
}

export function clearBest(missionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key(missionId));
  } catch {
    // ignore
  }
}
