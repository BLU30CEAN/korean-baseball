export type Mark = "strike" | "ball" | "out";

export type GameStatus = "playing" | "won" | "lost";

export type GameOutcome = "won" | "lost";

export type GameEndReason = "solved" | "exhausted" | "give-up";

export interface WordEntry {
  word: string;
  jamo: string;
  pos?: string;
  parts?: string[];
  definition?: string;
}

export interface Attempt {
  guess: string;
  marks: Mark[];
}

export interface GameStats {
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
}

export interface SharedGameSnapshot {
  version: 1;
  outcome: GameOutcome;
  reason: GameEndReason;
  answer: WordEntry;
  attempts: Attempt[];
  stats: GameStats;
  createdAt: number;
}

export interface KeyboardState {
  [key: string]: Mark;
}
