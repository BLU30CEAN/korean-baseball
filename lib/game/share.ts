import type { Attempt, GameStats, Mark, SharedGameSnapshot, WordEntry } from "@/lib/game/types";

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP = new Map<string, number>(
  BASE64_ALPHABET.split("").map((character, index) => [character, index] as const),
);

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let base64 = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const triple = (first << 16) | (second << 8) | third;

    base64 += BASE64_ALPHABET[(triple >> 18) & 63];
    base64 += BASE64_ALPHABET[(triple >> 12) & 63];
    base64 += index + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 63] : "=";
    base64 += index + 2 < bytes.length ? BASE64_ALPHABET[triple & 63] : "=";
  }

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const normalized = `${base64}${padding}`;
  const cleaned = normalized.replace(/=+$/u, "");

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const character of cleaned) {
    const value = BASE64_LOOKUP.get(character);

    if (value === undefined) {
      throw new Error("Invalid base64 character");
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }

  return new TextDecoder().decode(Uint8Array.from(bytes));
}

export function encodeShareSnapshot(snapshot: SharedGameSnapshot): string {
  return encodeBase64Url(JSON.stringify(snapshot));
}

export function decodeShareSnapshot(encoded: string): SharedGameSnapshot | null {
  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as Partial<SharedGameSnapshot>;

    if (!parsed || parsed.version !== 1) {
      return null;
    }

    if (parsed.outcome !== "won" && parsed.outcome !== "lost") {
      return null;
    }

    if (!parsed.answer?.word || !parsed.answer?.jamo) {
      return null;
    }

    if (!Array.isArray(parsed.attempts)) {
      return null;
    }

    if (!parsed.stats) {
      return null;
    }

    const answer: WordEntry = {
      word: parsed.answer.word,
      jamo: parsed.answer.jamo,
      definition: typeof parsed.answer.definition === "string" ? parsed.answer.definition : undefined,
    };

    const attempts: Attempt[] = parsed.attempts
      .map((attempt) => {
        if (!attempt || typeof attempt.guess !== "string" || !Array.isArray(attempt.marks)) {
          return null;
        }

        const marks = attempt.marks.map((mark) =>
          mark === "strike" || mark === "strikeDup" || mark === "ball" || mark === "out" ? mark : "out",
        ) as Mark[];

        return {
          guess: attempt.guess,
          marks,
        };
      })
      .filter((attempt): attempt is Attempt => attempt !== null);

    const stats: GameStats = {
      wins: Number.isFinite(parsed.stats.wins) ? Number(parsed.stats.wins) : 0,
      losses: Number.isFinite(parsed.stats.losses) ? Number(parsed.stats.losses) : 0,
      currentStreak: Number.isFinite(parsed.stats.currentStreak) ? Number(parsed.stats.currentStreak) : 0,
      bestStreak: Number.isFinite(parsed.stats.bestStreak) ? Number(parsed.stats.bestStreak) : 0,
    };

    return {
      version: 1,
      outcome: parsed.outcome,
      reason:
        parsed.reason === "solved" || parsed.reason === "exhausted" || parsed.reason === "give-up"
          ? parsed.reason
          : "solved",
      answer,
      attempts,
      stats,
      createdAt: Number.isFinite(parsed.createdAt) ? Number(parsed.createdAt) : Date.now(),
    };
  } catch {
    return null;
  }
}

function markToEmoji(mark: Attempt["marks"][number]): string {
  if (mark === "strike") return "🟩";
  if (mark === "strikeDup") return "🟢";
  if (mark === "ball") return "🟨";
  return "⬛";
}

export function buildShareText(snapshot: SharedGameSnapshot): string {
  const outcomeLabel = snapshot.reason === "give-up" ? "포기" : snapshot.outcome === "won" ? "성공" : "실패";
  const lines = [
    "한글 야구 결과",
    `${outcomeLabel} · 연승 ${snapshot.stats.currentStreak} · 최고 ${snapshot.stats.bestStreak}`,
    `정답: ${snapshot.answer.word}`,
  ];

  if (snapshot.answer.definition) {
    lines.push(`뜻풀이: ${snapshot.answer.definition}`);
  }

  lines.push("", ...snapshot.attempts.map((attempt) => attempt.marks.map(markToEmoji).join("")));

  return lines.join("\n");
}
