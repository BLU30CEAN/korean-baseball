"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACTION_KEY_ROW,
  type KeyboardKey,
  MAX_ATTEMPTS,
  QWERTY_KEY_ROWS,
  TYPEABLE_JAMO,
  WORD_LENGTH,
  applyJamoInput,
  resolvePhysicalKey,
} from "@/lib/game/keymap";
import {
  applyHintMark,
  createDefaultHintCounts,
  getHintCandidates,
  pickHintCandidate,
  type HintCounts,
  type HintKind,
  type HintState,
} from "@/lib/game/hints";
import { buildShareText, encodeShareSnapshot } from "@/lib/game/share";
import { applyGameOutcome, createDefaultGameStats, normalizeGameStats } from "@/lib/game/stats";
import { judgeGuess, isValidGuess, mergeKeyboardState } from "@/lib/game/logic";
import type {
  Attempt,
  GameEndReason,
  GameStats,
  GameStatus,
  KeyboardState,
  Mark,
  SharedGameSnapshot,
  WordEntry,
} from "@/lib/game/types";

function pickRandomWord(words: WordEntry[]): WordEntry | null {
  if (words.length === 0) {
    return null;
  }

  return words[Math.floor(Math.random() * words.length)] ?? null;
}

function getMarkClass(mark?: Mark): string {
  if (!mark) {
    return "tile";
  }

  return `tile tile--${mark}`;
}

function getKeyClass(mark?: Mark, disabled = false): string {
  const classes = ["key"];

  if (mark) {
    classes.push(`key--${mark}`);
  }

  if (disabled) {
    classes.push("key--disabled");
  }

  return classes.join(" ");
}

function isDefaultStats(stats: GameStats): boolean {
  return stats.wins === 0 && stats.losses === 0 && stats.currentStreak === 0 && stats.bestStreak === 0;
}

function loadStoredStats(): GameStats {
  if (typeof window === "undefined") {
    return createDefaultGameStats();
  }

  try {
    const raw = window.localStorage.getItem("word-baseball.stats.v1");
    if (!raw) {
      return createDefaultGameStats();
    }

    return normalizeGameStats(JSON.parse(raw) as Partial<GameStats>);
  } catch {
    return createDefaultGameStats();
  }
}

function persistStats(stats: GameStats) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem("word-baseball.stats.v1", JSON.stringify(stats));
  } catch {
    // ignore storage failures
  }
}

function createSnapshot({
  answer,
  attempts,
  stats,
  outcome,
  reason,
}: {
  answer: WordEntry;
  attempts: Attempt[];
  stats: GameStats;
  outcome: SharedGameSnapshot["outcome"];
  reason: GameEndReason;
}): SharedGameSnapshot {
  return {
    version: 1,
    outcome,
    reason,
    answer: { ...answer },
    attempts: attempts.map((attempt) => ({
      guess: attempt.guess,
      marks: [...attempt.marks],
    })),
    stats: { ...stats },
    createdAt: Date.now(),
  };
}

function getBannerTitle(result: SharedGameSnapshot): string {
  if (result.reason === "give-up") {
    return "포기했다";
  }

  if (result.outcome === "won") {
    return "정답을 맞췄다";
  }

  return `${MAX_ATTEMPTS}번 안에 못 맞췄다`;
}

function getBannerCopy(result: SharedGameSnapshot): string {
  if (result.reason === "give-up") {
    return `포기 처리했다. 정답은 ${result.answer.word} (${result.answer.jamo})이다.`;
  }

  if (result.outcome === "won") {
    return `정답은 ${result.answer.word} (${result.answer.jamo})이다.`;
  }

  return `정답은 ${result.answer.word} (${result.answer.jamo})이었다.`;
}

const HINT_BUTTON_CONFIG: Record<HintKind, { title: string; note: string }> = {
  remove: {
    title: "랜덤 제거",
    note: "안 쓰는 키 1개",
  },
  yellow: {
    title: "노란 힌트",
    note: "정답에 있는 키 1개",
  },
  green: {
    title: "초록 힌트",
    note: "정답에 있는 키 1개",
  },
};

const HINT_BUTTON_ORDER: HintKind[] = ["remove", "yellow", "green"];

export interface WordBaseballGameProps {
  validWords: string[];
  answerPool: WordEntry[];
  initialAnswer: WordEntry | null;
}

export default function WordBaseballGame({ validWords, answerPool, initialAnswer }: WordBaseballGameProps) {
  const validWordSet = useMemo(() => new Set(validWords), [validWords]);

  const [answer, setAnswer] = useState<WordEntry | null>(() => initialAnswer ?? pickRandomWord(answerPool));
  const [history, setHistory] = useState<Attempt[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({});
  const [status, setStatus] = useState<GameStatus>("playing");
  const [toast, setToast] = useState<{ message: string; tone: "danger" | "success" } | null>(null);
  const [shakeNonce, setShakeNonce] = useState(0);
  const [stats, setStats] = useState<GameStats>(() => createDefaultGameStats());
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [lastResult, setLastResult] = useState<SharedGameSnapshot | null>(null);
  const [hintCounts, setHintCounts] = useState<HintCounts>(() => createDefaultHintCounts());
  const [hintState, setHintState] = useState<HintState>({});
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const pushToast = useCallback(
    (message: string, tone: "danger" | "success" = "danger") => {
      clearToastTimer();
      setToast({ message, tone });
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 1400);
    },
    [clearToastTimer],
  );

  useEffect(() => {
    return () => {
      clearToastTimer();
    };
  }, [clearToastTimer]);

  useEffect(() => {
    const storedStats = loadStoredStats();

    setStats((current) => {
      if (!isDefaultStats(current)) {
        return current;
      }

      return storedStats;
    });

    setStatsLoaded(true);
  }, []);

  const resetGame = useCallback(() => {
    const nextAnswer = pickRandomWord(answerPool);

    if (!nextAnswer) {
      return;
    }

    clearToastTimer();
    setAnswer(nextAnswer);
    setHistory([]);
    setCurrentGuess([]);
    setKeyboardState({});
    setStatus("playing");
    setToast(null);
    setShakeNonce(0);
    setHintCounts(createDefaultHintCounts());
    setHintState({});
    setLastResult(null);
  }, [answerPool, clearToastTimer]);

  const finalizeGame = useCallback(
    (reason: GameEndReason, attempts: Attempt[]) => {
      if (!answer) {
        return;
      }

      const outcome = reason === "solved" ? "won" : "lost";
      const baseStats = statsLoaded ? stats : loadStoredStats();
      const nextStats = applyGameOutcome(baseStats, outcome);
      const snapshot = createSnapshot({
        answer,
        attempts,
        stats: nextStats,
        outcome,
        reason,
      });

      setHistory(attempts);
      setStats(nextStats);
      setLastResult(snapshot);
      setStatus(outcome === "won" ? "won" : "lost");
      setCurrentGuess([]);
      setShakeNonce(0);
      persistStats(nextStats);

      if (reason === "give-up") {
        pushToast(`포기했다. 정답은 ${answer.word}이다.`);
        return;
      }

      if (outcome === "won") {
        pushToast("정답!", "success");
        return;
      }

      pushToast("아쉽지만 실패했어요.");
    },
    [answer, pushToast, stats, statsLoaded],
  );

  const commitGuess = useCallback(() => {
    if (status !== "playing" || !answer) {
      return;
    }

    if (currentGuess.length !== WORD_LENGTH) {
      pushToast("다섯 글자를 모두 입력하세요.");
      setShakeNonce((value) => value + 1);
      return;
    }

    const guess = currentGuess.join("");

    if (!isValidGuess(guess, validWordSet, WORD_LENGTH)) {
      pushToast("없는 단어입니다.");
      setShakeNonce((value) => value + 1);
      return;
    }

    const answerLetters = answer.jamo.split("");
    const marks = judgeGuess(currentGuess, answerLetters);
    const nextAttemptCount = history.length + 1;
    const nextHistory: Attempt[] = [...history, { guess, marks }];

    setKeyboardState((previous) => mergeKeyboardState(previous, currentGuess, marks));

    if (guess === answer.jamo) {
      finalizeGame("solved", nextHistory);
      return;
    }

    if (nextAttemptCount >= MAX_ATTEMPTS) {
      finalizeGame("exhausted", nextHistory);
      return;
    }

    setHistory(nextHistory);
    setCurrentGuess([]);
  }, [answer, currentGuess, finalizeGame, history, pushToast, status, validWordSet]);

  const handleGiveUp = useCallback(() => {
    if (status !== "playing" || !answer) {
      return;
    }

    finalizeGame("give-up", history);
  }, [answer, finalizeGame, history, status]);

  const handleShare = useCallback(async () => {
    if (!lastResult) {
      return;
    }

    const shareUrl = new URL("/share", window.location.origin);
    shareUrl.searchParams.set("payload", encodeShareSnapshot(lastResult));
    const shareText = buildShareText(lastResult);
    const clipboardText = `${shareText}\n${shareUrl.toString()}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "한글 야구 결과",
          text: shareText,
          url: shareUrl.toString(),
        });
        pushToast("공유를 열었다.", "success");
        return;
      }

      await navigator.clipboard.writeText(clipboardText);
      pushToast("공유 링크를 복사했다.", "success");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      try {
        await navigator.clipboard.writeText(clipboardText);
        pushToast("공유 링크를 복사했다.", "success");
      } catch {
        pushToast("공유에 실패했다.");
      }
    }
  }, [lastResult, pushToast]);

  const handleHint = useCallback(
    (kind: HintKind) => {
      if (status !== "playing" || !answer) {
        return;
      }

      if (hintCounts[kind] <= 0) {
        pushToast("힌트가 더 없다.");
        return;
      }

      const candidates = getHintCandidates(kind, answer.jamo, keyboardState, hintState);
      const chosen = pickHintCandidate(candidates);

      if (!chosen) {
        pushToast("더 보여줄 힌트가 없다.");
        return;
      }

      setHintCounts((current) => ({
        ...current,
        [kind]: current[kind] - 1,
      }));
      setHintState((current) => applyHintMark(current, chosen, kind));
      pushToast(`${HINT_BUTTON_CONFIG[kind].title}: ${chosen}`, "success");
    },
    [answer, hintCounts, hintState, keyboardState, pushToast, status],
  );

  const renderKeyboardButton = (keyEntry: { physical: string; label: string }) => {
    if (keyEntry.physical === "Enter") {
      const disabled = status !== "playing" || currentGuess.length !== WORD_LENGTH;

      return (
        <button
          key={keyEntry.physical}
          type="button"
          className={`key key--wide${disabled ? " key--disabled" : ""}`}
          onClick={() => handlePress(keyEntry.label)}
          disabled={disabled}
        >
          <span className="keyLabel">{keyEntry.label}</span>
        </button>
      );
    }

    if (keyEntry.physical === "Backspace") {
      const disabled = status !== "playing";

      return (
        <button
          key={keyEntry.physical}
          type="button"
          className={`key key--wide${disabled ? " key--disabled" : ""}`}
          onClick={() => handlePress(keyEntry.label)}
          disabled={disabled}
        >
          <span className="keyLabel">{keyEntry.label}</span>
        </button>
      );
    }

    const mark = keyboardState[keyEntry.label] ?? hintState[keyEntry.label];
    const buttonDisabled = status !== "playing";

    return (
      <button
        key={keyEntry.physical}
        type="button"
        className={getKeyClass(mark, buttonDisabled)}
        onClick={() => handlePress(keyEntry.label)}
        disabled={buttonDisabled}
        aria-label={`${keyEntry.label}${mark ? ` ${mark}` : ""}`}
      >
        <span className="keyLabel">{keyEntry.label}</span>
      </button>
    );
  };

  const renderKeyboardRow = (
    row: readonly { physical: string; label: string }[],
    rowKey: string,
    rowClassName = "",
  ) => (
    <div
      key={rowKey}
      className={`keyboardRow${rowClassName ? ` ${rowClassName}` : ""}`}
      style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
    >
      {row.map(renderKeyboardButton)}
    </div>
  );

  const handleLetter = useCallback(
    (letter: string) => {
      if (status !== "playing" || !TYPEABLE_JAMO.has(letter)) {
        return;
      }

      setCurrentGuess((previous) => {
        const next = applyJamoInput(previous, letter);
        return next.length > WORD_LENGTH ? previous : next;
      });
    },
    [status],
  );

  const handleBackspace = useCallback(() => {
    if (status !== "playing") {
      return;
    }

    setCurrentGuess((previous) => previous.slice(0, -1));
  }, [status]);

  const handlePress = useCallback(
    (value: string) => {
      if (value === "Enter") {
        commitGuess();
        return;
      }

      if (value === "⌫" || value === "Backspace") {
        handleBackspace();
        return;
      }

      handleLetter(value);
    },
    [commitGuess, handleBackspace, handleLetter],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      const resolved = resolvePhysicalKey(event.key);

      if (!resolved) {
        return;
      }

      event.preventDefault();
      handlePress(resolved);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handlePress]);

  const attemptsLeft = Math.max(MAX_ATTEMPTS - history.length, 0);
  const isLoading = !answer || validWords.length === 0 || answerPool.length === 0;
  const hasWon = status === "won";
  const hasLost = status === "lost";

  if (isLoading) {
    return (
      <main className="loadingState">
        <div className="loadingCard">
          <div className="spinner" />
          <h1 className="heroTitle">한글 야구를 준비하는 중</h1>
          <p className="heroCopy">단어 목록을 불러오고 있어. 잠깐만 기다리면 바로 시작된다.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="pageShell">
      <section className="gameCard" aria-label="한글 야구 게임">
        <header className="hero">
          <h1 className="heroTitle">한글 야구</h1>
          <p className="heroCopy">
            {MAX_ATTEMPTS}번 안에 5자모 단어를 맞춰라. 모음은 모두 열려 있고, 같은 글자는 반복될 수 있다.
          </p>

          <div className="statsRow" aria-label="게임 상태">
            <span className="statChip">남은 시도 {attemptsLeft} / {MAX_ATTEMPTS}</span>
            <span className="statChip">현재 입력 {currentGuess.length} / {WORD_LENGTH}</span>
            <span className="statChip">연승 {stats.currentStreak}</span>
            <span className="statChip">최고 {stats.bestStreak}</span>
            <span className="statChip">정답 후보 {answerPool.length}개</span>
          </div>

          <div className="hintActions" aria-label="힌트">
            {HINT_BUTTON_ORDER.map((kind) => {
              const config = HINT_BUTTON_CONFIG[kind];
              const disabled = status !== "playing" || hintCounts[kind] <= 0;

              return (
                <button
                  key={kind}
                  type="button"
                  className={`key hintButton hintButton--${kind}${disabled ? " key--disabled" : ""}`}
                  onClick={() => handleHint(kind)}
                  disabled={disabled}
                  aria-label={`${config.title} ${hintCounts[kind]}회 남음`}
                >
                  <span className="hintButtonTitle">{config.title}</span>
                  <span className="hintButtonNote">{config.note}</span>
                  <span className="hintButtonCount">{hintCounts[kind]}회</span>
                </button>
              );
            })}
          </div>

          <div className="shareActions">
            <button
              type="button"
              className={`key key--danger actionButton${status !== "playing" ? " key--disabled" : ""}`}
              onClick={handleGiveUp}
              disabled={status !== "playing"}
            >
              포기하기
            </button>
            <button
              type="button"
              className={`key actionButton${!lastResult ? " key--disabled" : ""}`}
              onClick={handleShare}
              disabled={!lastResult}
            >
              공유하기
            </button>
          </div>
        </header>

        <div className="body">
          {(hasWon || hasLost) && (
            <div className={`banner ${hasWon ? "banner--win" : "banner--lose"}`}>
              <h2 className="bannerTitle">{lastResult ? getBannerTitle(lastResult) : "게임 종료"}</h2>
              <p className="bannerCopy">{lastResult ? getBannerCopy(lastResult) : ""}</p>
              {lastResult?.answer.definition ? (
                <p className="bannerCopy">뜻풀이: {lastResult.answer.definition}</p>
              ) : null}
              <button
                type="button"
                className="key"
                style={{ width: "100%", marginTop: 12 }}
                onClick={resetGame}
              >
                다시 하기
              </button>
            </div>
          )}

          <div className="board" aria-label="시도 보드">
            {Array.from({ length: MAX_ATTEMPTS }, (_, rowIndex) => {
              const attempt = history[rowIndex];
              const isActiveRow = rowIndex === history.length && status === "playing";
              const letters = attempt ? attempt.guess.split("") : isActiveRow ? currentGuess : [];
              const marks = attempt?.marks;
              const rowKey = isActiveRow ? `active-${rowIndex}-${shakeNonce}` : `row-${rowIndex}`;

              return (
                <div
                  key={rowKey}
                  className={`boardRow${isActiveRow && shakeNonce > 0 ? " boardRow--shake" : ""}`}
                >
                  {Array.from({ length: WORD_LENGTH }, (_, cellIndex) => {
                    const letter = letters[cellIndex];
                    const mark = marks?.[cellIndex];

                    return (
                      <div
                        key={cellIndex}
                        className={`${getMarkClass(mark)}${letter ? " tile--filled" : " tile--empty"}`}
                        aria-label={letter ? `${cellIndex + 1}번째 칸 ${letter}` : `${cellIndex + 1}번째 빈 칸`}
                      >
                        {letter ?? ""}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="keyboard" aria-label="입력 키보드">
            <section className="keyboardSection" aria-label="QWERTY">
              <p className="keyboardSectionTitle">QWERTY</p>
              {QWERTY_KEY_ROWS.map((row, rowIndex) =>
                renderKeyboardRow(
                  row,
                  `qwerty-${rowIndex}`,
                  rowIndex === 1 ? "keyboardRow--offset-1" : rowIndex === 2 ? "keyboardRow--offset-2" : "",
                ),
              )}
            </section>

            <section className="keyboardSection" aria-label="조작">
              <p className="keyboardSectionTitle">조작</p>
              {renderKeyboardRow(ACTION_KEY_ROW, ACTION_KEY_ROW.map((key) => key.physical).join("-"))}
            </section>
          </div>

          <p className="footerHint">
            힌트는 제거 3회, 노란색 2회, 초록색 1회다. Enter만 제출된다. 틀린 단어는 toast만 뜨고 시도 횟수는 그대로다. ㅘ/ㅙ 같은 복합 모음은 ㅗ+ㅏ, ㅗ+ㅐ처럼 조합된다.
          </p>

          <div className={`toast${toast ? " toast--visible" : ""}${toast?.tone === "danger" ? " toast--danger" : ""}`} role="status" aria-live="polite">
            {toast?.message ?? " "}
          </div>
        </div>
      </section>
    </main>
  );
}
