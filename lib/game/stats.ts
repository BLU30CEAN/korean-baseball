import type { GameOutcome, GameStats } from "@/lib/game/types";

export const DEFAULT_GAME_STATS: GameStats = {
  wins: 0,
  losses: 0,
  currentStreak: 0,
  bestStreak: 0,
};

export function createDefaultGameStats(): GameStats {
  return { ...DEFAULT_GAME_STATS };
}

export function applyGameOutcome(stats: GameStats, outcome: GameOutcome): GameStats {
  if (outcome === "won") {
    const currentStreak = stats.currentStreak + 1;

    return {
      wins: stats.wins + 1,
      losses: stats.losses,
      currentStreak,
      bestStreak: Math.max(stats.bestStreak, currentStreak),
    };
  }

  return {
    wins: stats.wins,
    losses: stats.losses + 1,
    currentStreak: 0,
    bestStreak: stats.bestStreak,
  };
}

export function normalizeGameStats(value: Partial<GameStats> | null | undefined): GameStats {
  if (!value) {
    return createDefaultGameStats();
  }

  const wins = Number.isFinite(value.wins) ? Number(value.wins) : 0;
  const losses = Number.isFinite(value.losses) ? Number(value.losses) : 0;
  const currentStreak = Number.isFinite(value.currentStreak) ? Number(value.currentStreak) : 0;
  const bestStreak = Number.isFinite(value.bestStreak) ? Number(value.bestStreak) : 0;

  return {
    wins,
    losses,
    currentStreak,
    bestStreak,
  };
}
