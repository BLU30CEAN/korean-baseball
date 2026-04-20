import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isHangulWord, toJamoString } from "../lib/game/hangul";
import { isTypeableWord } from "../lib/game/keymap";

interface RawEntry {
  word?: string;
  pos?: string;
  senses?: Array<{
    glosses?: string[];
    definitions?: string[];
    pos?: string;
  }>;
}

interface WordBankEntry {
  word: string;
  jamo: string;
  pos?: string;
  parts: string[];
  definition: string;
}

interface CandidateWord {
  word: string;
  jamo: string;
  pos?: string;
  parts: string[];
  fallbackDefinition?: string;
}

interface KrdictSense {
  definition?: string;
  pos?: string;
}

interface KrdictItem {
  word?: string;
  sense?: KrdictSense | KrdictSense[];
}

interface KrdictSearchResponse {
  channel?: {
    item?: KrdictItem | KrdictItem[];
  };
  error?: {
    error_code?: number | string;
    message?: string;
  };
}

const SOURCE_URL = "https://kaikki.org/dictionary/Korean/kaikki.org-dictionary-Korean.jsonl";
const OUTPUT_DIR = resolve(process.cwd(), "data");
const VALID_OUTPUT = resolve(OUTPUT_DIR, "valid-words.json");
const ANSWER_OUTPUT = resolve(OUTPUT_DIR, "answer-pool.json");
const KRDICT_KEY = process.env.KRDICT_KEY?.trim() ?? "";
const ALLOW_WORDBANK_FALLBACK = process.env.ALLOW_WORDBANK_FALLBACK === "1";

const NON_ANSWER_POS = new Set([
  "affix",
  "character",
  "conjunction",
  "contraction",
  "interfix",
  "particle",
  "postposition",
  "prefix",
  "punctuation",
  "root",
  "suffix",
  "syllable",
  "symbol",
]);

const FALLBACK_BANK: WordBankEntry[] = [
  {
    word: "숫자",
    jamo: "ㅅㅜㅅㅈㅏ",
    pos: "noun",
    parts: ["noun"],
    definition: "사물을 세거나 순서를 나타내는 말.",
  },
  {
    word: "학교",
    jamo: "ㅎㅏㄱㄱㅛ",
    pos: "noun",
    parts: ["noun"],
    definition: "교육을 받기 위하여 일정한 교육 과정을 조직한 기관.",
  },
  {
    word: "사람",
    jamo: "ㅅㅏㄹㅏㅁ",
    pos: "noun",
    parts: ["noun"],
    definition: "생각하고 말을 하며 사회를 이루어 사는 존재.",
  },
  {
    word: "라면",
    jamo: "ㄹㅏㅁㅕㄴ",
    pos: "noun",
    parts: ["noun"],
    definition: "밀가루 반죽을 얇고 가늘게 눌러 말린 국수.",
  },
  {
    word: "거울",
    jamo: "ㄱㅓㅇㅜㄹ",
    pos: "noun",
    parts: ["noun"],
    definition: "물체의 모습을 비추어 보게 하는 평평하고 매끈한 표면의 물건.",
  },
  {
    word: "재롱",
    jamo: "ㅈㅐㄹㅗㅇ",
    pos: "noun",
    parts: ["noun"],
    definition: "어린아이가 귀엽게 부리는 장난.",
  },
  {
    word: "숙주",
    jamo: "ㅅㅜㄱㅈㅜ",
    pos: "noun",
    parts: ["noun"],
    definition: "콩나물의 한 종류.",
  },
  {
    word: "꽃밭",
    jamo: "ㄲㅗㅊㅂㅏㅊ",
    pos: "noun",
    parts: ["noun"],
    definition: "꽃을 기르는 밭.",
  },
  {
    word: "바람",
    jamo: "ㅂㅏㄹㅏㅁ",
    pos: "noun",
    parts: ["noun"],
    definition: "공기가 움직이는 현상.",
  },
  {
    word: "소금",
    jamo: "ㅅㅗㄱㅡㅁ",
    pos: "noun",
    parts: ["noun"],
    definition: "바닷물을 증발시켜 얻는 하얀 결정체.",
  },
];

function normalizePos(pos?: string): string | undefined {
  const trimmed = pos?.trim().toLowerCase();
  return trimmed || undefined;
}

function isAnswerPos(pos?: string): boolean {
  if (!pos) {
    return true;
  }

  return !NON_ANSWER_POS.has(pos);
}

function uniqueParts(parts: string[]): string[] {
  return [...new Set(parts)].filter(Boolean).sort();
}

function pickFallbackDefinition(entry: RawEntry): string | undefined {
  for (const sense of entry.senses ?? []) {
    const gloss = sense.glosses?.find((value) => value.trim());
    if (gloss) {
      return gloss.trim();
    }

    const definition = sense.definitions?.find((value) => value.trim());
    if (definition) {
      return definition.trim();
    }
  }

  return undefined;
}

function pickFallbackPos(entry: RawEntry): string | undefined {
  const pos = normalizePos(entry.pos);
  if (pos) {
    return pos;
  }

  for (const sense of entry.senses ?? []) {
    const sensePos = normalizePos(sense.pos);
    if (sensePos) {
      return sensePos;
    }
  }

  return undefined;
}

function toBankEntry(value: WordBankEntry) {
  return {
    word: value.word,
    jamo: value.jamo,
    pos: value.pos,
    parts: uniqueParts(value.parts),
    definition: value.definition,
  };
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-fA-F]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function extractXmlTagValues(block: string, tagName: string): string[] {
  const pattern = new RegExp(String.raw`<${tagName}>([\s\S]*?)<\/${tagName}>`, "g");
  return [...block.matchAll(pattern)].map((match) => decodeXml(match[1].trim()));
}

function parseKrdictItem(item: string): WordBankEntry | null {
  const word = extractXmlTagValues(item, "word")[0]?.trim().normalize("NFC") ?? "";
  if (!word || !isHangulWord(word) || !isTypeableWord(word)) {
    return null;
  }

  const jamo = toJamoString(word);
  if (jamo.length !== 5) {
    return null;
  }

  const definition = extractXmlTagValues(item, "definition")[0]?.trim();
  if (!definition) {
    return null;
  }

  const pos = normalizePos(extractXmlTagValues(item, "pos")[0]);

  return {
    word,
    jamo,
    pos,
    parts: pos ? [pos] : [],
    definition,
  };
}

async function fetchKrdictDefinition(word: string): Promise<string | undefined> {
  if (!KRDICT_KEY) {
    return undefined;
  }

  const url = new URL("https://krdict.korean.go.kr/api/search");
  url.searchParams.set("key", KRDICT_KEY);
  url.searchParams.set("q", word);
  url.searchParams.set("req_type", "xml");
  url.searchParams.set("part", "word");
  url.searchParams.set("num", "10");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`KRDICT search failed for ${word}: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  for (const item of items) {
    const itemWord = extractXmlTagValues(item, "word")[0]?.trim();
    if (itemWord !== word) {
      continue;
    }

    const definitions = extractXmlTagValues(item, "definition");
    if (definitions.length > 0) {
      return definitions[0];
    }
  }

  return undefined;
}

async function fetchKrdictPrefixEntries(prefix: string): Promise<WordBankEntry[]> {
  if (!KRDICT_KEY) {
    return [];
  }

  const url = new URL("https://krdict.korean.go.kr/api/search");
  url.searchParams.set("key", KRDICT_KEY);
  url.searchParams.set("q", prefix);
  url.searchParams.set("req_type", "xml");
  url.searchParams.set("advanced", "y");
  url.searchParams.set("target", "1");
  url.searchParams.set("method", "start");
  url.searchParams.set("num", "200");
  url.searchParams.set("start", "1");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`KRDICT prefix search failed for ${prefix}: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const entries: WordBankEntry[] = [];

  for (const item of items) {
    const entry = parseKrdictItem(item);
    if (!entry) {
      continue;
    }

    if (!entry.word.startsWith(prefix)) {
      continue;
    }

    entries.push(entry);
  }

  return entries;
}

function scoreWordEntry(entry: WordBankEntry): number {
  return (isAnswerPos(entry.pos) ? 1_000_000 : 0) + entry.definition.length;
}

function mergeWordEntries(entries: WordBankEntry[]): WordBankEntry[] {
  const merged = new Map<string, WordBankEntry>();

  for (const entry of entries) {
    const existing = merged.get(entry.jamo);

    if (!existing || scoreWordEntry(entry) > scoreWordEntry(existing)) {
      merged.set(entry.jamo, entry);
    }
  }

  return [...merged.values()];
}

async function resolveCandidateDefinition(candidate: CandidateWord): Promise<WordBankEntry | null> {
  if (KRDICT_KEY) {
    try {
      const definition = await fetchKrdictDefinition(candidate.word);
      if (!definition) {
        return null;
      }

      return {
        word: candidate.word,
        jamo: candidate.jamo,
        pos: candidate.pos,
        parts: uniqueParts(candidate.parts),
        definition,
      };
    } catch {
      return null;
    }
  }

  if (!candidate.fallbackDefinition) {
    return null;
  }

  return {
    word: candidate.word,
    jamo: candidate.jamo,
    pos: candidate.pos,
    parts: uniqueParts(candidate.parts),
    definition: candidate.fallbackDefinition,
  };
}

async function mapConcurrent<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R | null>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const value = await mapper(items[index]);
      if (value !== null) {
        results.push(value);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

async function writeBank(entries: WordBankEntry[]) {
  const stableEntries = entries
    .slice()
    .sort((left, right) => left.jamo.localeCompare(right.jamo, "ko"));

  const validWords = stableEntries.map((entry) => entry.jamo);
  const answerPool = stableEntries.filter((entry) => isAnswerPos(entry.pos));

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(VALID_OUTPUT, `${JSON.stringify(validWords, null, 2)}\n`, "utf8");
  await writeFile(ANSWER_OUTPUT, `${JSON.stringify(answerPool.map(toBankEntry), null, 2)}\n`, "utf8");

  console.log(`wrote ${validWords.length} valid words to ${VALID_OUTPUT}`);
  console.log(`wrote ${answerPool.length} answer candidates to ${ANSWER_OUTPUT}`);
}

async function buildFromSource() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download source: ${response.status} ${response.statusText}`);
  }

  const lines = createInterface({
    input: Readable.fromWeb(response.body as any),
    crlfDelay: Infinity,
  });

  const candidates: CandidateWord[] = [];
  let processed = 0;
  let kept = 0;

  for await (const line of lines) {
    processed += 1;
    if (!line) {
      continue;
    }

    let parsed: RawEntry;
    try {
      parsed = JSON.parse(line) as RawEntry;
    } catch {
      continue;
    }

    const word = typeof parsed.word === "string" ? parsed.word.normalize("NFC") : "";
    if (!word || !isHangulWord(word) || !isTypeableWord(word)) {
      continue;
    }

    const jamo = toJamoString(word);
    if (jamo.length !== 5) {
      continue;
    }

    const pos = pickFallbackPos(parsed);
    const fallbackDefinition = pickFallbackDefinition(parsed);
    candidates.push({
      word,
      jamo,
      pos,
      parts: pos ? [pos] : [],
      fallbackDefinition,
    });
    kept += 1;
  }

  console.log(`processed ${processed} lines, kept ${kept} unique 5-jamo candidates`);

  const validated = await mapConcurrent(candidates, 8, resolveCandidateDefinition);
  const prefixSeeds = [...new Set(candidates.map((candidate) => candidate.word.normalize("NFC")[0] ?? ""))].filter(Boolean);
  const prefixBatches = await mapConcurrent(prefixSeeds, 6, fetchKrdictPrefixEntries);
  const supplementalEntries = prefixBatches.flat();

  const entries = mergeWordEntries([...validated, ...supplementalEntries]);

  if (entries.length === 0) {
    throw new Error("No definitive KRDICT-backed words were generated.");
  }

  await writeBank(entries);
}

async function main() {
  if (!KRDICT_KEY && !ALLOW_WORDBANK_FALLBACK) {
    throw new Error("KRDICT_KEY is required to build a definitive word bank.");
  }

  try {
    await buildFromSource();
  } catch (error) {
    if (!ALLOW_WORDBANK_FALLBACK) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`source download failed, writing fallback bank instead: ${message}`);
    await writeBank(FALLBACK_BANK);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
