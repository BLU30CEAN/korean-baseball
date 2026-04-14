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

function expandJamo(jamo: string): string[] {
  return JUNGSEONG_SPLITS[jamo] ?? JONGSEONG_SPLITS[jamo] ?? [jamo];
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
    const choIndex = Math.floor(syllableIndex / (JUNGSEONG_COUNT * JONGSEONG_COUNT));
    const jungIndex = Math.floor((syllableIndex % (JUNGSEONG_COUNT * JONGSEONG_COUNT)) / JONGSEONG_COUNT);
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

export function isPlayableWord(word: string, expectedLength = 5): boolean {
  return isHangulWord(word) && countJamo(word) === expectedLength;
}
