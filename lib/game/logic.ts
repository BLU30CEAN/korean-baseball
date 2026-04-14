import type { KeyboardState, Mark } from "@/lib/game/types";

const MARK_PRIORITY: Record<Mark, number> = {
  out: 0,
  ball: 1,
  strike: 2,
};

export function judgeGuess(guess: string[], answer: string[]): Mark[] {
  const marks: Mark[] = Array.from({ length: guess.length }, () => "out");
  const remaining = new Map<string, number>();

  for (let index = 0; index < answer.length; index += 1) {
    if (guess[index] === answer[index]) {
      marks[index] = "strike";
      continue;
    }

    const current = remaining.get(answer[index]) ?? 0;
    remaining.set(answer[index], current + 1);
  }

  for (let index = 0; index < guess.length; index += 1) {
    if (marks[index] === "strike") {
      continue;
    }

    const current = remaining.get(guess[index]) ?? 0;
    if (current > 0) {
      marks[index] = "ball";
      remaining.set(guess[index], current - 1);
    }
  }

  return marks;
}

export function upgradeMark(current: Mark | undefined, incoming: Mark): Mark {
  if (!current) {
    return incoming;
  }

  return MARK_PRIORITY[incoming] > MARK_PRIORITY[current] ? incoming : current;
}

export function mergeKeyboardState(
  current: KeyboardState,
  guess: string[],
  marks: Mark[],
): KeyboardState {
  const next: KeyboardState = { ...current };

  guess.forEach((letter, index) => {
    next[letter] = upgradeMark(next[letter], marks[index]);
  });

  return next;
}

export function isValidGuess(guess: string, validWords: Set<string>, expectedLength = 5): boolean {
  return guess.length === expectedLength && validWords.has(guess);
}
