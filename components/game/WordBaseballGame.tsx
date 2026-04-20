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
import {
  applyGameOutcome,
  createDefaultGameStats,
  normalizeGameStats,
} from "@/lib/game/stats";
import { judgeGuess, isValidGuess, mergeKeyboardState } from "@/lib/game/logic";
import {
  validateWordRealtime,
  type ValidationResult,
} from "@/lib/game/word-validator";
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

function pickRandomPlayableAnswer(
  pool: WordEntry[],
  validSet: Set<string>,
): WordEntry | null {
  const playable = pool.filter((entry) => validSet.has(entry.jamo));

  if (playable.length === 0) {
    return null;
  }

  return playable[Math.floor(Math.random() * playable.length)] ?? null;
}

function resolveInitialAnswer(
  initial: WordEntry | null,
  pool: WordEntry[],
  validSet: Set<string>,
): WordEntry | null {
  if (initial && validSet.has(initial.jamo)) {
    return initial;
  }

  return pickRandomPlayableAnswer(pool, validSet);
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
  return (
    stats.wins === 0 &&
    stats.losses === 0 &&
    stats.currentStreak === 0 &&
    stats.bestStreak === 0
  );
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
    window.localStorage.setItem(
      "word-baseball.stats.v1",
      JSON.stringify(stats),
    );
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

const HINT_BUTTON_ORDER: HintKind[] = ["remove"];
const CORE_HINT_LIMIT = 1;
const NICKNAME_STORAGE_KEY = "word-baseball.nickname.v1";
const THEME_STORAGE_KEY = "word-baseball.theme.v1";
const LOADING_HERO_COPY_INITIAL =
  "단어 목록을 불러오고 있어. 잠깐만 기다리면 바로 시작된다.";
const LOADING_HERO_COPY_SLOW = "사실 느립니다. 미안해오";
const LOADING_HERO_COPY_SLOW_DELAY_MS = 3000;

type ThemeMode = "dark" | "light";

interface SecurityAnswers {
  phonePrefix: string;
  middle4: string;
  account2: string;
}

type SecurityField = keyof SecurityAnswers;

const SECURITY_FIELD_KEYS: SecurityField[] = [
  "phonePrefix",
  "middle4",
  "account2",
];

const SECURITY_PROMPTS: Record<
  SecurityField,
  { copy: string; placeholder: string; maxLength: number; submitLabel: string }
> = {
  phonePrefix: {
    copy: "오늘 먹은 점심 가격 앞자리 3개 입력하라. (예: 010)",
    placeholder: "010",
    maxLength: 3,
    submitLabel: "확인",
  },
  middle4: {
    copy: "세상에서 제일 좋아하는 숫자 4개 입력하라.",
    placeholder: "1234",
    maxLength: 4,
    submitLabel: "확인",
  },
  account2: {
    copy: "어제 꾼 꿈 번호 뒤 2자리 입력하라.",
    placeholder: "12",
    maxLength: 2,
    submitLabel: "확인",
  },
};

const EMPTY_SECURITY_ANSWERS: SecurityAnswers = {
  phonePrefix: "",
  middle4: "",
  account2: "",
};

function pickRandomSecurityField(except?: SecurityField): SecurityField {
  const candidates = except
    ? SECURITY_FIELD_KEYS.filter((field) => field !== except)
    : SECURITY_FIELD_KEYS;
  return (
    candidates[Math.floor(Math.random() * candidates.length)] ?? "phonePrefix"
  );
}

const INVALID_WORD_TOASTS = [
  "없는 단어입니다. :(",
  "없는 단어. :(",
  "없는 단어라고. :<",
  "없다고 ㅡㅡ",
  "어ㅄ ;)",
  "외국인?\n外国人?\n外国の方ですか?\nForeigner?\nNgười nước ngoài?\nAusländer?\n¿Extranjero?",
] as const;

function getInvalidWordToast(streak: number): string {
  const index = Math.min(
    Math.max(streak - 1, 0),
    INVALID_WORD_TOASTS.length - 1,
  );
  return INVALID_WORD_TOASTS[index];
}

export interface WordBaseballGameProps {
  validWords: string[];
  answerPool: WordEntry[];
  initialAnswer: WordEntry | null;
}

export default function WordBaseballGame({
  validWords,
  answerPool,
  initialAnswer,
}: WordBaseballGameProps) {
  const validWordSet = useMemo(() => new Set(validWords), [validWords]);
  const playableAnswerCount = useMemo(
    () => answerPool.filter((entry) => validWordSet.has(entry.jamo)).length,
    [answerPool, validWordSet],
  );

  const [answer, setAnswer] = useState<WordEntry | null>(() =>
    resolveInitialAnswer(initialAnswer, answerPool, new Set(validWords)),
  );
  const [history, setHistory] = useState<Attempt[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({});
  const [status, setStatus] = useState<GameStatus>("playing");
  const [toast, setToast] = useState<{
    message: string;
    tone: "danger" | "success";
  } | null>(null);
  const [shakeNonce, setShakeNonce] = useState(0);
  const [stats, setStats] = useState<GameStats>(() => createDefaultGameStats());
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [lastResult, setLastResult] = useState<SharedGameSnapshot | null>(null);
  const [hintCounts, setHintCounts] = useState<HintCounts>(() =>
    createDefaultHintCounts(),
  );
  const [hintState, setHintState] = useState<HintState>({});
  const [coreHintUsed, setCoreHintUsed] = useState(0);
  const [nickname, setNickname] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [securityOpen, setSecurityOpen] = useState(false);
  const [securityField, setSecurityField] =
    useState<SecurityField>("phonePrefix");
  const [securityAnswers, setSecurityAnswers] = useState<SecurityAnswers>(
    EMPTY_SECURITY_ANSWERS,
  );
  const [securityRetryErrors, setSecurityRetryErrors] = useState(0);
  const [invalidWordStreak, setInvalidWordStreak] = useState(0);
  const [gameSessionId, setGameSessionId] = useState(() => String(Date.now()));
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [loadingHeroCopy, setLoadingHeroCopy] = useState(
    LOADING_HERO_COPY_INITIAL,
  );
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
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      setThemeMode(stored);
      return;
    }
    const prefersLight = window.matchMedia(
      "(prefers-color-scheme: light)",
    ).matches;
    setThemeMode(prefersLight ? "light" : "dark");
  }, []);

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

  const submitNickname = useCallback(
    async (candidate: string, newUser: boolean) => {
      const normalized = candidate.trim().replace(/\s+/g, " ");
      if (normalized.length < 2 || normalized.length > 20) {
        setAuthError("닉네임은 2~20자로 입력해라.");
        return false;
      }

      setAuthPending(true);
      setAuthError("");

      try {
        const response = await fetch("/api/user/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nickname: normalized,
            isNewUser: newUser,
          }),
        });

        const parsed = (await response.json()) as {
          ok?: boolean;
          error?: string;
        };
        if (!response.ok || !parsed.ok) {
          setAuthError(parsed.error ?? "닉네임 인증에 실패했다.");
          return false;
        }

        setNickname(normalized);
        window.localStorage.setItem(NICKNAME_STORAGE_KEY, normalized);
        return true;
      } catch {
        setAuthError("닉네임 인증 중 네트워크 오류가 발생했다.");
        return false;
      } finally {
        setAuthPending(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(NICKNAME_STORAGE_KEY);
    if (!saved) {
      setAuthReady(true);
      return;
    }

    void (async () => {
      const success = await submitNickname(saved, false);
      if (!success) {
        window.localStorage.removeItem(NICKNAME_STORAGE_KEY);
      } else {
        setNicknameInput(saved);
      }
      setAuthReady(true);
    })();
  }, [submitNickname]);

  const sendAttemptLog = useCallback(
    async (
      attempt: Attempt,
      attemptNo: number,
      outcome: "attempt" | "won" | "lost",
      reason: "attempt" | "solved" | "exhausted",
    ) => {
      if (!nickname || !answer) {
        return;
      }

      const defaults = createDefaultHintCounts();
      const payload = {
        nickname,
        problemNo: gameSessionId,
        rowType: "attempt" as const,
        attemptNo,
        guess: attempt.guess,
        marks: attempt.marks.join("|"),
        answerWord: answer.word,
        answerJamo: answer.jamo,
        outcome,
        reason,
        attemptCount: attemptNo,
        hintRemoveUsed: defaults.remove - hintCounts.remove,
        hintYellowUsed: defaults.yellow - hintCounts.yellow,
        hintGreenUsed: defaults.green - hintCounts.green,
        hintCoreUsed: coreHintUsed,
        securityRetryErrors,
        securityPhonePrefix: securityAnswers.phonePrefix,
        securityMiddle4: securityAnswers.middle4,
        securityAccount2: securityAnswers.account2,
        attemptGuesses: attempt.guess,
      };

      try {
        await fetch("/api/game-log", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch {
        // Keep gameplay running even if log upload fails.
      }
    },
    [
      answer,
      gameSessionId,
      hintCounts,
      coreHintUsed,
      nickname,
      securityAnswers,
      securityRetryErrors,
    ],
  );

  const resetGame = useCallback(() => {
    const nextAnswer = pickRandomPlayableAnswer(answerPool, validWordSet);

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
    setCoreHintUsed(0);
    setSecurityOpen(false);
    setSecurityField("phonePrefix");
    setSecurityAnswers(EMPTY_SECURITY_ANSWERS);
    setSecurityRetryErrors(0);
    setInvalidWordStreak(0);
    setGameSessionId(String(Date.now()));
    setLastResult(null);
  }, [answerPool, clearToastTimer, validWordSet]);

  useEffect(() => {
    setAnswer((current) => {
      if (!current) {
        return current;
      }

      if (validWordSet.has(current.jamo)) {
        return current;
      }

      return pickRandomPlayableAnswer(answerPool, validWordSet);
    });
  }, [answerPool, validWordSet]);

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

  const commitGuess = useCallback(async () => {
    if (status !== "playing" || !answer) {
      return;
    }

    if (currentGuess.length !== WORD_LENGTH) {
      pushToast("다섯 글자를 모두 입력하세요.");
      setShakeNonce((value) => value + 1);
      return;
    }

    const guess = currentGuess.join("");

    // First check local word bank
    if (!isValidGuess(guess, validWordSet, WORD_LENGTH)) {
      // Real-time validation with KRDICT API
      try {
        const validation = await validateWordRealtime(guess);

        if (!validation.isValid) {
          setInvalidWordStreak((current) => {
            const next = current + 1;
            pushToast(getInvalidWordToast(next));
            return next;
          });
          setShakeNonce((value) => value + 1);
          return;
        }

        // Valid word found via API
        const cacheIndicator = validation.fromCache ? " (캐시)" : " (검증)";
        pushToast(`단어 확인됨${cacheIndicator}`, "success");
      } catch (error) {
        // API failed, fall back to basic pattern check
        if (guess.length === WORD_LENGTH && /^[가-힣]+$/u.test(guess)) {
          pushToast("네트워크 오류. 한글 단어로 진행합니다.", "success");
        } else {
          setInvalidWordStreak((current) => {
            const next = current + 1;
            pushToast(getInvalidWordToast(next));
            return next;
          });
          setShakeNonce((value) => value + 1);
          return;
        }
      }
    }

    const answerLetters = answer.jamo.split("");
    const marks = judgeGuess(currentGuess, answerLetters);
    const nextAttemptCount = history.length + 1;
    const currentAttempt: Attempt = { guess, marks };
    const nextHistory: Attempt[] = [...history, currentAttempt];
    setInvalidWordStreak(0);
    setKeyboardState((previous) =>
      mergeKeyboardState(previous, currentGuess, marks),
    );

    if (guess === answer.jamo) {
      void sendAttemptLog(currentAttempt, nextAttemptCount, "won", "solved");
      finalizeGame("solved", nextHistory);
      return;
    }

    if (nextAttemptCount >= MAX_ATTEMPTS) {
      void sendAttemptLog(
        currentAttempt,
        nextAttemptCount,
        "lost",
        "exhausted",
      );
      finalizeGame("exhausted", nextHistory);
      return;
    }

    void sendAttemptLog(currentAttempt, nextAttemptCount, "attempt", "attempt");
    setHistory(nextHistory);
    setCurrentGuess([]);
  }, [
    answer,
    currentGuess,
    finalizeGame,
    history,
    pushToast,
    sendAttemptLog,
    status,
    validWordSet,
  ]);

  const handleGiveUp = useCallback(() => {
    if (status !== "playing" || !answer) {
      return;
    }

    finalizeGame("give-up", history);
  }, [answer, finalizeGame, history, status]);

  const handleSecurityStart = useCallback(() => {
    setSecurityOpen(true);
    setSecurityAnswers(EMPTY_SECURITY_ANSWERS);
    setSecurityField(pickRandomSecurityField());
  }, []);

  const handleSecurityField = useCallback(
    (field: keyof SecurityAnswers, value: string) => {
      setSecurityAnswers((current) => ({
        ...current,
        [field]: value.replace(/\s+/g, ""),
      }));
    },
    [],
  );

  const handleSecurityNext = useCallback(() => {
    const value = securityAnswers[securityField];
    const isValid =
      securityField === "phonePrefix"
        ? value === "010"
        : securityField === "middle4"
          ? /^\d{4}$/u.test(value)
          : /^\d{2}$/u.test(value);

    if (!isValid) {
      setSecurityRetryErrors((current) => current + 1);
      setSecurityAnswers((current) => ({ ...current, [securityField]: "" }));
      setSecurityField((current) => pickRandomSecurityField(current));
      pushToast("보안검사 실패. 다른 무작위 질문으로 다시 시도해라.", "danger");
      return;
    }

    setSecurityOpen(false);
    resetGame();
  }, [pushToast, resetGame, securityAnswers, securityField]);

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

  const toggleThemeMode = useCallback(() => {
    setThemeMode((current) => {
      const next: ThemeMode = current === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      return next;
    });
  }, []);

  const handleHint = useCallback(
    (kind: HintKind) => {
      if (status !== "playing" || !answer) {
        return;
      }

      if (hintCounts[kind] <= 0) {
        pushToast("힌트가 더 없다.");
        return;
      }

      const candidates = getHintCandidates(
        kind,
        answer.jamo,
        keyboardState,
        hintState,
      );
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

  const handleCoreHint = useCallback(() => {
    if (status !== "playing" || !answer) {
      return;
    }
    if (history.length !== MAX_ATTEMPTS - 1) {
      pushToast("핵심 힌트는 마지막 시도에서만 사용 가능하다.");
      return;
    }
    if (coreHintUsed >= CORE_HINT_LIMIT) {
      pushToast("핵심 힌트는 이미 사용했다.");
      return;
    }

    const candidates = getHintCandidates(
      "green",
      answer.jamo,
      keyboardState,
      hintState,
    );
    const chosen = pickHintCandidate(candidates);
    if (!chosen) {
      pushToast("더 보여줄 핵심 힌트가 없다.");
      return;
    }

    setCoreHintUsed(1);
    setHintState((current) => applyHintMark(current, chosen, "green"));
    pushToast(`핵심 힌트: ${chosen}`, "success");
  }, [
    answer,
    coreHintUsed,
    hintState,
    history.length,
    keyboardState,
    pushToast,
    status,
  ]);

  const renderKeyboardButton = (keyEntry: {
    physical: string;
    label: string;
  }) => {
    if (keyEntry.physical === "Enter") {
      const disabled =
        status !== "playing" || currentGuess.length !== WORD_LENGTH;

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
  const isLoading =
    !answer ||
    validWords.length === 0 ||
    answerPool.length === 0 ||
    playableAnswerCount === 0;
  const isWordLoading = authReady && !!nickname && isLoading;

  useEffect(() => {
    if (!isWordLoading) {
      setLoadingHeroCopy(LOADING_HERO_COPY_INITIAL);
      return;
    }

    setLoadingHeroCopy(LOADING_HERO_COPY_INITIAL);
    const timeoutId = setTimeout(() => {
      setLoadingHeroCopy(LOADING_HERO_COPY_SLOW);
    }, LOADING_HERO_COPY_SLOW_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isWordLoading]);
  const hasWon = status === "won";
  const hasLost = status === "lost";

  if (!authReady) {
    return (
      <main className="loadingState" data-theme={themeMode}>
        <div className="loadingCard">
          <div className="spinner" />
          <h1 className="heroTitle">사용자 정보를 확인하는 중</h1>
          <p className="heroCopy">잠깐만 기다리면 바로 시작된다.</p>
        </div>
      </main>
    );
  }

  if (!nickname) {
    return (
      <main className="loadingState" data-theme={themeMode}>
        <div className="loadingCard authCard authCard--brand">
          <button
            type="button"
            className="themeToggle"
            onClick={toggleThemeMode}
          >
            {themeMode === "dark" ? "Light" : "Dark"}
          </button>
          <h1 className="loginBrand">WBG</h1>
          {/* <p className="loginSubtitle">Word Baseball Game</p> */}
          <p className="heroCopy">
            닉네임을 입력하고 시작해라. 닉네임은 중복 허용되지 않는다.
          </p>
          <input
            className="authInput"
            value={nicknameInput}
            onChange={(event) => setNicknameInput(event.target.value)}
            placeholder="닉네임"
            maxLength={20}
          />
          <label className="authCheck">
            <input
              type="checkbox"
              checked={isNewUser}
              onChange={(event) => setIsNewUser(event.target.checked)}
            />
            신규 사용자인가?
          </label>
          {authError ? <p className="authError">{authError}</p> : null}
          <button
            type="button"
            className={`key actionButton${authPending ? " key--disabled" : ""}`}
            disabled={authPending}
            onClick={async () => {
              const success = await submitNickname(nicknameInput, isNewUser);
              if (success) {
                setNicknameInput((value) => value.trim().replace(/\s+/g, " "));
              }
            }}
          >
            {authPending ? (
              <span className="buttonLoading">
                <span className="spinnerInline" />
                확인 중...
              </span>
            ) : (
              "시작하기"
            )}
          </button>
          <p className="creditLine">copyright © gurengeo upda. BBO feat.PSY</p>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="loadingState" data-theme={themeMode}>
        <div className="loadingCard">
          <div className="spinner" />
          <h1 className="heroTitle">한글 야구를 준비하는 중</h1>
          <p className="heroCopy">{loadingHeroCopy}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="pageShell" data-theme={themeMode}>
      <section className="gameCard" aria-label="한글 야구 게임">
        <header className="hero">
          <div className="heroTop">
            <h1 className="heroTitle">WBG</h1>
            <button
              type="button"
              className="themeToggle"
              onClick={toggleThemeMode}
            >
              {themeMode === "dark" ? "Light" : "Dark"}
            </button>
          </div>
          <p className="heroCopy">{MAX_ATTEMPTS}번 안에 5자모 단어를 맞춰라.</p>

          <details className="gameDetails">
            <summary className="gameDetailsSummary">규칙</summary>
            <div className="gameDetailsBody">
              <p>틀린 단어는 횟수 미차감. 회색 키도 다시 누를 수 있다.</p>
              <p>힌트는 랜덤 제거 3회 + 마지막 시도 핵심 힌트 1회.</p>
            </div>
          </details>
        </header>

        <div className="body">
          {(hasWon || hasLost) && (
            <div
              className={`banner ${hasWon ? "banner--win" : "banner--lose"}`}
            >
              <h2 className="bannerTitle">
                {lastResult ? getBannerTitle(lastResult) : "게임 종료"}
              </h2>
              <p className="bannerCopy">
                {lastResult ? getBannerCopy(lastResult) : ""}
              </p>
              {lastResult?.answer.definition ? (
                <details className="resultDetails">
                  <summary className="resultDetailsSummary">
                    뜻풀이 보기
                  </summary>
                  <p className="bannerCopy">{lastResult.answer.definition}</p>
                </details>
              ) : null}
              <button
                type="button"
                className="key"
                style={{ width: "100%", marginTop: 12 }}
                onClick={handleSecurityStart}
              >
                다시 하기
              </button>
            </div>
          )}

          <div className="board" aria-label="시도 보드">
            {Array.from({ length: MAX_ATTEMPTS }, (_, rowIndex) => {
              const attempt = history[rowIndex];
              const isActiveRow =
                rowIndex === history.length && status === "playing";
              const letters = attempt
                ? attempt.guess.split("")
                : isActiveRow
                  ? currentGuess
                  : [];
              const marks = attempt?.marks;
              const rowKey = isActiveRow
                ? `active-${rowIndex}-${shakeNonce}`
                : `row-${rowIndex}`;

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
                        aria-label={
                          letter
                            ? `${cellIndex + 1}번째 칸 ${letter}`
                            : `${cellIndex + 1}번째 빈 칸`
                        }
                      >
                        {letter ?? ""}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="controlRail" aria-label="남은 시도와 힌트">
            <div className="attemptRail">
              <span className="attemptChip">
                남은 시도 {attemptsLeft} / {MAX_ATTEMPTS}
              </span>
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
                    <span className="hintButtonCount">
                      {hintCounts[kind]}회
                    </span>
                  </button>
                );
              })}
              {status === "playing" && attemptsLeft === 1 ? (
                <button
                  type="button"
                  className={`key hintButton hintButton--green${coreHintUsed >= CORE_HINT_LIMIT ? " key--disabled" : ""}`}
                  onClick={handleCoreHint}
                  disabled={coreHintUsed >= CORE_HINT_LIMIT}
                  aria-label={`핵심 힌트 ${Math.max(CORE_HINT_LIMIT - coreHintUsed, 0)}회 남음`}
                >
                  <span className="hintButtonTitle">핵심 힌트</span>
                  <span className="hintButtonNote">못 찾은 글자 1개</span>
                  <span className="hintButtonCount">
                    {Math.max(CORE_HINT_LIMIT - coreHintUsed, 0)}회
                  </span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="keyboard" aria-label="입력 키보드">
            {QWERTY_KEY_ROWS.map((row, rowIndex) =>
              renderKeyboardRow(
                row,
                `qwerty-${rowIndex}`,
                rowIndex === 1
                  ? "keyboardRow--offset-1"
                  : rowIndex === 2
                    ? "keyboardRow--offset-2"
                    : "",
              ),
            )}
            {renderKeyboardRow(
              ACTION_KEY_ROW,
              ACTION_KEY_ROW.map((key) => key.physical).join("-"),
            )}
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
            <a className="key actionButton" href="/stats">
              통계
            </a>
          </div>

          {securityOpen ? (
            <div
              className="securityOverlay"
              role="dialog"
              aria-modal="true"
              aria-label="보안 검사"
            >
              <div className="securityCard">
                <h3 className="securityTitle">보안검사</h3>
                <p className="securityCopy">
                  {SECURITY_PROMPTS[securityField].copy}
                </p>
                <input
                  className="securityInput"
                  value={securityAnswers[securityField]}
                  onChange={(event) =>
                    handleSecurityField(securityField, event.target.value)
                  }
                  maxLength={SECURITY_PROMPTS[securityField].maxLength}
                  inputMode="numeric"
                  placeholder={SECURITY_PROMPTS[securityField].placeholder}
                />
                <div className="securityActions">
                  <button
                    type="button"
                    className="key key--danger"
                    onClick={() => setSecurityOpen(false)}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="key"
                    onClick={handleSecurityNext}
                  >
                    {SECURITY_PROMPTS[securityField].submitLabel}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={`toast${toast ? " toast--visible" : ""}${toast?.tone === "danger" ? " toast--danger" : ""}`}
            role="status"
            aria-live="polite"
          >
            {toast?.message ?? " "}
          </div>
          <p className="creditLine">BOO feat.PSY</p>
        </div>
      </section>
    </main>
  );
}
