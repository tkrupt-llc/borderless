import { PhraseList } from "@/lib/contracts/phrases";
import raw from "@/content/rules/phrases.json";

/**
 * Case-insensitive phrase check, run on every patient message before and after
 * the AI call (Day 4 wires it into the conversation route). Matches whole words
 * only, so "skills" never matches "kill". Apostrophes, hyphens and curly quotes
 * are ignored, so "can’t go on", "cant go on" and "can't go on" all match.
 * A match means "ask a direct check question", never a silent label.
 */

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’‘`]/g, "") // can't -> cant
    .replace(/[^\p{L}\p{N}]+/gu, " ") // punctuation and hyphens -> space
    .trim();
}

const list = PhraseList.parse(raw);
const normalisedPhrases = [...new Set(list.phrases.map(normalise))];

export type PhraseMatch = { matched: string[] };

export function checkPhrases(text: string, phrases: readonly string[] = normalisedPhrases): PhraseMatch {
  const haystack = ` ${normalise(text)} `;
  const matched = phrases.map(normalise).filter((p) => p && haystack.includes(` ${p} `));
  return { matched: [...new Set(matched)] };
}

export const phraseListVersion = list.version;
