import WordBaseballGame from "@/components/game/WordBaseballGame";
import answerPool from "@/data/answer-pool.json";
import validWords from "@/data/valid-words.json";
import { TYPEABLE_JAMO } from "@/lib/game/keymap";
import type { WordEntry } from "@/lib/game/types";

export const dynamic = "force-dynamic";

const typeableJamoSequence = (value: string) =>
  [...value].every((char) => TYPEABLE_JAMO.has(char));

const typedAnswerPool = (answerPool as WordEntry[]).filter((entry) =>
  typeableJamoSequence(entry.jamo),
);
const typedValidWords = (validWords as string[]).filter(typeableJamoSequence);
const typedValidWordSet = new Set(typedValidWords);

function pickRandomPlayableAnswer(pool: WordEntry[], validSet: Set<string>): WordEntry | null {
  const playable = pool.filter((entry) => validSet.has(entry.jamo));

  if (playable.length === 0) {
    return null;
  }

  return playable[Math.floor(Math.random() * playable.length)] ?? null;
}

export default function Page() {
  return (
    <WordBaseballGame
      answerPool={typedAnswerPool}
      validWords={typedValidWords}
      initialAnswer={pickRandomPlayableAnswer(typedAnswerPool, typedValidWordSet)}
    />
  );
}
