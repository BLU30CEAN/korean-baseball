import test from "node:test";
import assert from "node:assert/strict";
import { buildShareText, decodeShareSnapshot, encodeShareSnapshot } from "../lib/game/share";
import type { SharedGameSnapshot } from "../lib/game/types";

const snapshot: SharedGameSnapshot = {
  version: 1,
  outcome: "won",
  reason: "solved",
  answer: {
    word: "숫자",
    jamo: "ㅅㅜㅅㅈㅏ",
    definition: undefined,
  },
  attempts: [
    {
      guess: "ㅅㅜㅅㅈㅏ",
      marks: ["strike", "strike", "strike", "strike", "strike"],
    },
  ],
  stats: {
    wins: 1,
    losses: 0,
    currentStreak: 1,
    bestStreak: 1,
  },
  createdAt: 1,
};

test("share snapshot roundtrips", () => {
  const encoded = encodeShareSnapshot(snapshot);
  const decoded = decodeShareSnapshot(encoded);

  assert.deepEqual(decoded, snapshot);
});

test("share snapshot roundtrips with strikeDup marks", () => {
  const extended: SharedGameSnapshot = {
    ...snapshot,
    attempts: [
      {
        guess: "ㅅㅜㅅㅈㅏ",
        marks: ["strikeDup", "strike", "ball", "strikeDup", "out"],
      },
    ],
  };

  const encoded = encodeShareSnapshot(extended);
  const decoded = decodeShareSnapshot(encoded);

  assert.deepEqual(decoded, extended);
});

test("share text includes the result summary", () => {
  const text = buildShareText(snapshot);

  assert.match(text, /한글 야구 결과/);
  assert.match(text, /성공/);
  assert.match(text, /연승 1/);
  assert.match(text, /정답: 숫자/);
});

test("share text maps strikeDup to emoji", () => {
  const extended: SharedGameSnapshot = {
    ...snapshot,
    attempts: [{ guess: "ㅅㅜㅅㅈㅏ", marks: ["strikeDup", "strike", "ball", "out", "out"] }],
  };

  const text = buildShareText(extended);

  assert.match(text, /🟢/);
});
