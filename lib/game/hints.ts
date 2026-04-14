import { TYPEABLE_JAMO } from "@/lib/game/keymap";
import type { KeyboardState, Mark } from "@/lib/game/types";

export type HintKind = "remove" | "yellow" | "green";

export interface HintCounts {
  remove: number;
  yellow: number;
  green: number;
}

export type HintState = Partial<Record<string, Mark>>;

export const DEFAULT_HINT_COUNTS: HintCounts = {
  remove: 3,
  yellow: 2,
  green: 1,
};

const HINT_MARK_BY_KIND: Record<HintKind, Mark> = {
  remove: "out",
  yellow: "ball",
  green: "strike",
};

export function createDefaultHintCounts(): HintCounts {
  return { ...DEFAULT_HINT_COUNTS };
}

export function getHintMark(kind: HintKind): Mark {
  return HINT_MARK_BY_KIND[kind];
}

function uniqueLetters(value: string): string[] {
  return [...new Set(value.split(""))];
}

function getAnswerLetters(answerJamo: string): string[] {
  return uniqueLetters(answerJamo).filter((letter) => TYPEABLE_JAMO.has(letter));
}

function isKnown(keyboardState: KeyboardState, hintState: HintState, letter: string): boolean {
  return keyboardState[letter] !== undefined || hintState[letter] !== undefined;
}

export function getHintCandidates(
  kind: HintKind,
  answerJamo: string,
  keyboardState: KeyboardState,
  hintState: HintState,
): string[] {
  const answerLetters = getAnswerLetters(answerJamo);

  if (kind === "remove") {
    return [...TYPEABLE_JAMO].filter((letter) => !answerLetters.includes(letter) && !isKnown(keyboardState, hintState, letter));
  }

  return answerLetters.filter((letter) => !isKnown(keyboardState, hintState, letter));
}

export function pickHintCandidate(candidates: string[], random = Math.random): string | null {
  if (candidates.length === 0) {
    return null;
  }

  const index = Math.floor(random() * candidates.length);
  return candidates[index] ?? null;
}

export function applyHintMark(current: HintState, letter: string, kind: HintKind): HintState {
  return {
    ...current,
    [letter]: getHintMark(kind),
  };
}
