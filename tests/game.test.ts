import test from "node:test";
import assert from "node:assert/strict";
import {
  composeHangulWord,
  countJamo,
  isPlayableWord,
  toJamoString,
} from "../lib/game/hangul";
import { getHintCandidates, pickHintCandidate, createDefaultHintCounts, applyHintMark } from "../lib/game/hints";
import { isValidGuess, judgeGuess, mergeKeyboardState } from "../lib/game/logic";
import { MAX_ATTEMPTS, QWERTY_KEY_ROWS, applyJamoInput, isTypeableWord } from "../lib/game/keymap";
import type { KeyboardState } from "../lib/game/types";

test("hangul normalization", () => {
  assert.equal(toJamoString("숫자"), "ㅅㅜㅅㅈㅏ");
  assert.equal(toJamoString("과자"), "ㄱㅗㅏㅈㅏ");
  assert.equal(composeHangulWord("ㅅㅏㄱㅗㅏ"), "사과");
  assert.equal(composeHangulWord("ㅅㅏㄱㅘ"), "사과");
  assert.equal(toJamoString("원귀"), "ㅇㅜㅓㄴㄱㅜㅣ");
  assert.equal(countJamo("과자"), 5);
  assert.equal(countJamo("원귀"), 7);
  assert.equal(isPlayableWord("숫자"), true);
  assert.equal(isPlayableWord("사과"), true);
  assert.equal(isPlayableWord("과자"), true);
  assert.equal(isPlayableWord("원귀"), false);
  assert.equal(isPlayableWord("안녕"), false);
});

test("guess judging", () => {
  const marks = judgeGuess(["ㅂ", "ㅅ", "ㅂ", "ㅅ", "ㅂ"], ["ㅂ", "ㅂ", "ㅅ", "ㅅ", "ㅇ"]);
  assert.deepEqual(marks, ["strikeDup", "ball", "ball", "strikeDup", "out"]);
});

test("guess judging duplicate answer letters use strikeDup", () => {
  const marks = judgeGuess(["ㄱ", "ㄱ", "ㅏ", "ㅏ", "ㅂ"], ["ㄱ", "ㄱ", "ㅏ", "ㅏ", "ㅂ"]);
  assert.deepEqual(marks, ["strikeDup", "strikeDup", "strikeDup", "strikeDup", "strike"]);
});

test("guess judging 숫자 full match uses strikeDup for repeated jamo", () => {
  const jamo = "ㅅㅜㅅㅈㅏ".split("");
  assert.deepEqual(judgeGuess(jamo, jamo), ["strikeDup", "strike", "strikeDup", "strike", "strike"]);
});

test("keyboard state", () => {
  const next = mergeKeyboardState({}, ["ㅂ", "ㅅ", "ㅂ"], ["out", "ball", "strike"]);
  assert.equal(next["ㅂ"], "strike");
  assert.equal(next["ㅅ"], "ball");
});

test("keyboard state keeps strike when mixing strikeDup", () => {
  const next = mergeKeyboardState({ ㄱ: "strikeDup" }, ["ㄱ"], ["strike"]);
  assert.equal(next["ㄱ"], "strike");
});

test("guess validation", () => {
  const validWords = new Set(["ㅅㅜㅅㅈㅏ", "ㅎㅏㄱㄱㅛ"]);
  assert.equal(isValidGuess("ㅅㅜㅅㅈㅏ", validWords), true);
  assert.equal(isValidGuess("ㅅㅜㅅㅈ", validWords), false);
  assert.equal(isValidGuess("ㄱㅏㅅㅗㅇ", validWords), false);
});

test("typeable word filter", () => {
  assert.equal(MAX_ATTEMPTS, 6);
  assert.equal(isTypeableWord("숫자"), true);
  assert.equal(isTypeableWord("과자"), true);
  assert.equal(isTypeableWord("짜장"), false);
});

test("qwerty keyboard layout and atomic input", () => {
  assert.equal(QWERTY_KEY_ROWS[0][0].physical, "q");
  assert.equal(QWERTY_KEY_ROWS[0][0].label, "ㅂ");
  assert.deepEqual(applyJamoInput(["ㄱ", "ㅗ"], "ㅏ"), ["ㄱ", "ㅗ", "ㅏ"]);
  assert.deepEqual(applyJamoInput(["ㄱ", "ㅗ"], "ㅐ"), ["ㄱ", "ㅗ", "ㅐ"]);
  assert.deepEqual(applyJamoInput(["ㄱ"], "ㅘ"), ["ㄱ"]);
  assert.deepEqual(applyJamoInput(["ㄱ"], "q"), ["ㄱ"]);
});

test("hint candidates and counts", () => {
  assert.deepEqual(createDefaultHintCounts(), { remove: 3, yellow: 2, green: 1 });

  const keyboardState: KeyboardState = { ㄱ: "strike", ㅂ: "out" };
  const hintState = {};

  const removeCandidates = getHintCandidates("remove", "ㄱㅗㅏㅈㅏ", keyboardState, hintState);
  assert.equal(removeCandidates.includes("ㄱ"), false);
  assert.equal(removeCandidates.includes("ㅗ"), false);
  assert.equal(removeCandidates.includes("ㅏ"), false);
  assert.equal(removeCandidates.includes("ㅈ"), false);
  assert.equal(removeCandidates.includes("ㅂ"), false);
  assert.equal(removeCandidates.includes("ㄴ"), true);

  const yellowCandidates = getHintCandidates("yellow", "ㄱㅗㅏㅈㅏ", keyboardState, hintState);
  assert.deepEqual(yellowCandidates.sort(), ["ㅏ", "ㅗ", "ㅈ"].sort());

  const greenCandidates = getHintCandidates("green", "ㄱㅗㅏㅈㅏ", keyboardState, hintState);
  assert.deepEqual(greenCandidates.sort(), ["ㅏ", "ㅗ", "ㅈ"].sort());

  assert.equal(pickHintCandidate(["ㄱ", "ㅂ"], () => 0.99), "ㅂ");
  assert.deepEqual(applyHintMark({}, "ㄴ", "yellow"), { ㄴ: "ball" });
});
