import WordBaseballGame from "@/components/game/WordBaseballGame";
import answerPool from "@/data/answer-pool.json";
import validWords from "@/data/valid-words.json";
import type { WordEntry } from "@/lib/game/types";

export const dynamic = "force-dynamic";

const typedAnswerPool = answerPool as WordEntry[];
const typedValidWords = validWords as string[];

function pickRandomWord(words: WordEntry[]): WordEntry | null {
  if (words.length === 0) {
    return null;
  }

  return words[Math.floor(Math.random() * words.length)] ?? null;
}

export default function Page() {
  return (
    <WordBaseballGame
      answerPool={typedAnswerPool}
      validWords={typedValidWords}
      initialAnswer={pickRandomWord(typedAnswerPool)}
    />
  );
}
