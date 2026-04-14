import test from "node:test";
import assert from "node:assert/strict";
import { applyGameOutcome, createDefaultGameStats, normalizeGameStats } from "../lib/game/stats";

test("applyGameOutcome increments streak on win", () => {
  const next = applyGameOutcome(
    {
      wins: 3,
      losses: 1,
      currentStreak: 2,
      bestStreak: 4,
    },
    "won",
  );

  assert.deepEqual(next, {
    wins: 4,
    losses: 1,
    currentStreak: 3,
    bestStreak: 4,
  });
});

test("applyGameOutcome resets streak on loss", () => {
  const next = applyGameOutcome(
    {
      wins: 3,
      losses: 1,
      currentStreak: 2,
      bestStreak: 4,
    },
    "lost",
  );

  assert.deepEqual(next, {
    wins: 3,
    losses: 2,
    currentStreak: 0,
    bestStreak: 4,
  });
});

test("normalizeGameStats falls back to defaults", () => {
  assert.deepEqual(normalizeGameStats(null), createDefaultGameStats());
  assert.deepEqual(
    normalizeGameStats({
      wins: 2,
      losses: 3,
      currentStreak: 1,
      bestStreak: 3,
    }),
    {
      wins: 2,
      losses: 3,
      currentStreak: 1,
      bestStreak: 3,
    },
  );
});
