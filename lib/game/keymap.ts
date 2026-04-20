import { decomposeHangulWord } from "@/lib/game/hangul";

export const WORD_LENGTH = 5;
export const MAX_ATTEMPTS = 6;

export interface KeyboardKey {
  physical: string;
  label: string;
}

export const QWERTY_KEY_ROWS: KeyboardKey[][] = [
  [
    { physical: "q", label: "ㅂ" },
    { physical: "w", label: "ㅈ" },
    { physical: "e", label: "ㄷ" },
    { physical: "r", label: "ㄱ" },
    { physical: "t", label: "ㅅ" },
    { physical: "y", label: "ㅛ" },
    { physical: "u", label: "ㅕ" },
    { physical: "i", label: "ㅑ" },
  ],
  [
    { physical: "a", label: "ㅁ" },
    { physical: "s", label: "ㄴ" },
    { physical: "d", label: "ㅇ" },
    { physical: "f", label: "ㄹ" },
    { physical: "g", label: "ㅎ" },
    { physical: "h", label: "ㅗ" },
    { physical: "j", label: "ㅓ" },
    { physical: "k", label: "ㅏ" },
    { physical: "l", label: "ㅣ" },
  ],
  [
    { physical: "z", label: "ㅋ" },
    { physical: "x", label: "ㅌ" },
    { physical: "c", label: "ㅊ" },
    { physical: "v", label: "ㅍ" },
    { physical: "b", label: "ㅠ" },
    { physical: "n", label: "ㅜ" },
    { physical: "m", label: "ㅡ" },
  ],
] as const;

export const ACTION_KEY_ROW: KeyboardKey[] = [
  { physical: "Enter", label: "Enter" },
  { physical: "Backspace", label: "⌫" },
];

export const TYPEABLE_CONSONANTS = [
  "ㅂ",
  "ㅈ",
  "ㄷ",
  "ㄱ",
  "ㅅ",
  "ㅁ",
  "ㄴ",
  "ㅇ",
  "ㄹ",
  "ㅎ",
  "ㅋ",
  "ㅌ",
  "ㅊ",
  "ㅍ",
] as const;

export const TYPEABLE_VOWELS = [
  "ㅛ",
  "ㅕ",
  "ㅑ",
  "ㅒ",
  "ㅖ",
  "ㅗ",
  "ㅓ",
  "ㅏ",
  "ㅣ",
  "ㅜ",
  "ㅠ",
  "ㅡ",
] as const;

export const TYPEABLE_JAMO = new Set<string>([...TYPEABLE_CONSONANTS, ...TYPEABLE_VOWELS]);

export const PHYSICAL_KEY_TO_JAMO: Record<string, string> = {
  q: "ㅂ",
  w: "ㅈ",
  e: "ㄷ",
  r: "ㄱ",
  t: "ㅅ",
  y: "ㅛ",
  u: "ㅕ",
  i: "ㅑ",
  a: "ㅁ",
  s: "ㄴ",
  d: "ㅇ",
  f: "ㄹ",
  g: "ㅎ",
  h: "ㅗ",
  j: "ㅓ",
  k: "ㅏ",
  l: "ㅣ",
  z: "ㅋ",
  x: "ㅌ",
  c: "ㅊ",
  v: "ㅍ",
  b: "ㅠ",
  n: "ㅜ",
  m: "ㅡ",
};

export function resolvePhysicalKey(key: string): string | undefined {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  if (normalized === "enter") {
    return "Enter";
  }

  if (normalized === "backspace") {
    return "⌫";
  }

  if (TYPEABLE_JAMO.has(normalized)) {
    return normalized;
  }

  if (normalized in PHYSICAL_KEY_TO_JAMO) {
    return PHYSICAL_KEY_TO_JAMO[normalized];
  }

  return undefined;
}

export function isKeyboardLetter(key: string): boolean {
  return TYPEABLE_JAMO.has(key) || key in PHYSICAL_KEY_TO_JAMO;
}

export function isTypeableWord(word: string): boolean {
  const jamo = decomposeHangulWord(word);

  if (jamo.length !== WORD_LENGTH) {
    return false;
  }

  return jamo.every((char) => TYPEABLE_JAMO.has(char));
}

export function applyJamoInput(previous: string[], input: string): string[] {
  if (!TYPEABLE_JAMO.has(input)) {
    return previous;
  }

  return [...previous, input];
}
