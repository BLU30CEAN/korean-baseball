const HANGUL_BASE = 0xac00;
const CHOSEONG_COUNT = 19;
const JUNGSEONG_COUNT = 21;
const JONGSEONG_COUNT = 28;

const CHOSEONG = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
] as const;

const JUNGSEONG = [
  "ㅏ",
  "ㅐ",
  "ㅑ",
  "ㅒ",
  "ㅓ",
  "ㅔ",
  "ㅕ",
  "ㅖ",
  "ㅗ",
  "ㅘ",
  "ㅙ",
  "ㅚ",
  "ㅛ",
  "ㅜ",
  "ㅝ",
  "ㅞ",
  "ㅟ",
  "ㅠ",
  "ㅡ",
  "ㅢ",
  "ㅣ",
] as const;

const JUNGSEONG_SPLITS: Record<string, string[]> = {
  ㅘ: ["ㅗ", "ㅏ"],
  ㅙ: ["ㅗ", "ㅐ"],
  ㅚ: ["ㅗ", "ㅣ"],
  ㅝ: ["ㅜ", "ㅓ"],
  ㅞ: ["ㅜ", "ㅔ"],
  ㅟ: ["ㅜ", "ㅣ"],
  ㅢ: ["ㅡ", "ㅣ"],
};

const JONGSEONG = [
  "",
  "ㄱ",
  "ㄲ",
  "ㄳ",
  "ㄴ",
  "ㄵ",
  "ㄶ",
  "ㄷ",
  "ㄹ",
  "ㄺ",
  "ㄻ",
  "ㄼ",
  "ㄽ",
  "ㄾ",
  "ㄿ",
  "ㅀ",
  "ㅁ",
  "ㅂ",
  "ㅄ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
] as const;

const JONGSEONG_SPLITS: Record<string, string[]> = {
  ㄳ: ["ㄱ", "ㅅ"],
  ㄵ: ["ㄴ", "ㅈ"],
  ㄶ: ["ㄴ", "ㅎ"],
  ㄺ: ["ㄹ", "ㄱ"],
  ㄻ: ["ㄹ", "ㅁ"],
  ㄼ: ["ㄹ", "ㅂ"],
  ㄽ: ["ㄹ", "ㅅ"],
  ㄾ: ["ㄹ", "ㅌ"],
  ㄿ: ["ㄹ", "ㅍ"],
  ㅀ: ["ㄹ", "ㅎ"],
  ㅄ: ["ㅂ", "ㅅ"],
};

const CHOSEONG_SET = new Set<string>(CHOSEONG);
const JUNGSEONG_SET = new Set<string>(JUNGSEONG);
const JONGSEONG_SET = new Set<string>(JONGSEONG.filter(Boolean));

const COMPOSED_JUNGSEONG = new Map<string, string>(
  Object.entries(JUNGSEONG_SPLITS).map(([composite, parts]) => [
    parts.join(""),
    composite,
  ]),
);

const COMPOSED_JONGSEONG = new Map<string, string>(
  Object.entries(JONGSEONG_SPLITS).map(([composite, parts]) => [
    parts.join(""),
    composite,
  ]),
);

const CHOSEONG_INDEX = new Map<string, number>(
  CHOSEONG.map((value, index) => [value, index]),
);
const JUNGSEONG_INDEX = new Map<string, number>(
  JUNGSEONG.map((value, index) => [value, index]),
);
const JONGSEONG_INDEX = new Map<string, number>(
  JONGSEONG.map((value, index) => [value, index]),
);

function expandJamo(jamo: string): string[] {
  return JUNGSEONG_SPLITS[jamo] ?? JONGSEONG_SPLITS[jamo] ?? [jamo];
}

function isConsonantJamo(jamo: string): boolean {
  return CHOSEONG_SET.has(jamo) || JONGSEONG_SET.has(jamo);
}

function isVowelJamo(jamo: string): boolean {
  return JUNGSEONG_SET.has(jamo);
}

function composeJungseong(left: string, right: string): string | undefined {
  return COMPOSED_JUNGSEONG.get(`${left}${right}`);
}

function composeJongseong(left: string, right: string): string | undefined {
  return COMPOSED_JONGSEONG.get(`${left}${right}`);
}

function composeSyllable(cho: string, jung: string, jong = ""): string {
  const choIndex = CHOSEONG_INDEX.get(cho);
  const jungIndex = JUNGSEONG_INDEX.get(jung);
  const jongIndex = JONGSEONG_INDEX.get(jong);

  if (
    choIndex === undefined ||
    jungIndex === undefined ||
    jongIndex === undefined
  ) {
    return "";
  }

  return String.fromCodePoint(
    HANGUL_BASE +
      choIndex * JUNGSEONG_COUNT * JONGSEONG_COUNT +
      jungIndex * JONGSEONG_COUNT +
      jongIndex,
  );
}

export function isHangulSyllable(char: string): boolean {
  const code = char.codePointAt(0);
  return code !== undefined && code >= HANGUL_BASE && code <= 0xd7a3;
}

export function isHangulWord(word: string): boolean {
  return /^[가-힣]+$/.test(word.normalize("NFC"));
}

export function decomposeHangulWord(word: string): string[] {
  const normalized = word.normalize("NFC");
  const jamo: string[] = [];

  for (const char of normalized) {
    if (!isHangulSyllable(char)) {
      return [];
    }

    const syllableIndex = char.codePointAt(0)! - HANGUL_BASE;
    const choIndex = Math.floor(
      syllableIndex / (JUNGSEONG_COUNT * JONGSEONG_COUNT),
    );
    const jungIndex = Math.floor(
      (syllableIndex % (JUNGSEONG_COUNT * JONGSEONG_COUNT)) / JONGSEONG_COUNT,
    );
    const jongIndex = syllableIndex % JONGSEONG_COUNT;

    jamo.push(CHOSEONG[choIndex]);
    jamo.push(...expandJamo(JUNGSEONG[jungIndex]));

    const jong = JONGSEONG[jongIndex];
    if (jong) {
      jamo.push(...expandJamo(jong));
    }
  }

  return jamo;
}

export function toJamoString(word: string): string {
  return decomposeHangulWord(word).join("");
}

export function countJamo(word: string): number {
  return decomposeHangulWord(word).length;
}

export function composeHangulWord(word: string | string[]): string {
  const jamo = Array.isArray(word) ? [...word] : [...word.normalize("NFC")];
  const memo = new Map<number, string | null>();

  const composeFrom = (index: number): string | null => {
    if (index === jamo.length) {
      return "";
    }

    const cached = memo.get(index);
    if (cached !== undefined) {
      return cached;
    }

    const first = jamo[index];
    let cho = "";
    let vowelIndex = index;

    if (isConsonantJamo(first)) {
      cho = first;
      vowelIndex = index + 1;
    } else if (isVowelJamo(first)) {
      cho = "ㅇ";
    } else {
      memo.set(index, null);
      return null;
    }

    if (vowelIndex >= jamo.length || !isVowelJamo(jamo[vowelIndex])) {
      memo.set(index, null);
      return null;
    }

    const vowelCandidates: Array<{ jung: string; nextIndex: number }> = [
      { jung: jamo[vowelIndex], nextIndex: vowelIndex + 1 },
    ];

    if (vowelIndex + 1 < jamo.length && isVowelJamo(jamo[vowelIndex + 1])) {
      const composedVowel = composeJungseong(
        jamo[vowelIndex],
        jamo[vowelIndex + 1],
      );
      if (composedVowel) {
        vowelCandidates.push({
          jung: composedVowel,
          nextIndex: vowelIndex + 2,
        });
      }
    }

    for (const vowelCandidate of vowelCandidates) {
      const finalCandidates: Array<{ jong: string; nextIndex: number }> = [
        { jong: "", nextIndex: vowelCandidate.nextIndex },
      ];

      const next = jamo[vowelCandidate.nextIndex];
      if (next && isConsonantJamo(next)) {
        finalCandidates.push({
          jong: next,
          nextIndex: vowelCandidate.nextIndex + 1,
        });

        const nextNext = jamo[vowelCandidate.nextIndex + 1];
        if (nextNext && isConsonantJamo(nextNext)) {
          const composedFinal = composeJongseong(next, nextNext);
          if (composedFinal) {
            finalCandidates.push({
              jong: composedFinal,
              nextIndex: vowelCandidate.nextIndex + 2,
            });
          }
        }
      }

      for (const finalCandidate of finalCandidates) {
        const rest = composeFrom(finalCandidate.nextIndex);
        if (rest !== null) {
          const syllable = composeSyllable(
            cho,
            vowelCandidate.jung,
            finalCandidate.jong,
          );
          if (syllable) {
            const composed = syllable + rest;
            memo.set(index, composed);
            return composed;
          }
        }
      }
    }

    memo.set(index, null);
    return null;
  };

  return composeFrom(0) ?? "";
}

export function isPlayableWord(word: string, expectedLength = 5): boolean {
  return isHangulWord(word) && countJamo(word) === expectedLength;
}
