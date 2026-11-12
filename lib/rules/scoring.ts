import type { Instrument } from "@/lib/contracts/item-bank";
import { bankFile } from "@/lib/item-bank";
import type { Facts } from "./engine";

/**
 * Deterministic scoring. Never AI. Answers are keyed by item id ("PHQ9-3" -> 2).
 * A score is only produced when every required item is answered; a partial
 * questionnaire returns null, never a guessed total.
 */

export type Score = {
  instrument: Instrument;
  total: number;
  band: string;
  /** PHQ-2 / GAD-2 gate, or ASQ screen. */
  positive?: boolean;
  /** ASQ only: "yes" to the acuity question. */
  acute?: boolean;
};

type Band = readonly [min: number, max: number, band: string];

// Published severity bands.
const BANDS: Partial<Record<Instrument, readonly Band[]>> = {
  PHQ9: [
    [0, 4, "minimal"],
    [5, 9, "mild"],
    [10, 14, "moderate"],
    [15, 19, "moderately_severe"],
    [20, 27, "severe"],
  ],
  GAD7: [
    [0, 4, "minimal"],
    [5, 9, "mild"],
    [10, 14, "moderate"],
    [15, 21, "severe"],
  ],
};

/** PHQ-2 and GAD-2 are positive at 3 or more. */
const GATE_CUTOFF = 3;

export const SCORED_INSTRUMENTS = ["PHQ2", "PHQ9", "GAD2", "GAD7", "ASQ"] as const satisfies Instrument[];
export type ScoredInstrument = (typeof SCORED_INSTRUMENTS)[number];

export function score(instrument: ScoredInstrument, answers: Record<string, number>): Score | null {
  const file = bankFile(instrument);

  // Reject a value that is not one of the item's options: a bad value must never be scored.
  for (const item of file.items) {
    const value = answers[item.id];
    if (value !== undefined && !item.options.some((o) => o.value === value)) {
      throw new Error(`${item.id}: ${value} is not a valid answer`);
    }
  }

  if (instrument === "ASQ") return scoreAsq(answers);

  const values = file.items.filter((item) => item.scored !== false).map((item) => answers[item.id]);
  if (values.some((v) => v === undefined)) return null;
  const total = (values as number[]).reduce((sum, v) => sum + v, 0);

  if (instrument === "PHQ2" || instrument === "GAD2") {
    const positive = total >= GATE_CUTOFF;
    return { instrument, total, band: positive ? "positive" : "negative", positive };
  }

  const band = BANDS[instrument]!.find(([min, max]) => total >= min && total <= max);
  if (!band) throw new Error(`${instrument} total ${total} is outside every band`);
  return { instrument, total, band: band[2] };
}

/**
 * ASQ: items 1-4 are the screen; any "yes" is a positive screen. Item 5 (acuity) is
 * asked only after a positive screen: "yes" is an acute positive.
 * A positive screen is returned as soon as one "yes" is known, even if the
 * other items are unanswered, so risk is never held back by a missing answer.
 */
function scoreAsq(answers: Record<string, number>): Score | null {
  const screen = [1, 2, 3, 4].map((n) => answers[`ASQ-${n}`]);
  const yesCount = screen.filter((v) => v === 1).length;
  const positive = yesCount > 0;
  if (!positive && screen.some((v) => v === undefined)) return null;

  const acute = answers["ASQ-5"] === 1;
  const band = !positive ? "negative" : acute ? "acute_positive" : "non_acute_positive";
  return { instrument: "ASQ", total: yesCount, band, positive, acute };
}

/** Every score that can be computed from the answers so far. */
export function scoreAll(answers: Record<string, number>): Score[] {
  return SCORED_INSTRUMENTS.map((i) => score(i, answers)).filter((s): s is Score => s !== null);
}

/** score.<INSTRUMENT>.total / .positive / .acute facts for the rule files. */
export function factsFromScores(scores: Score[]): Facts {
  const facts: Facts = {};
  for (const s of scores) {
    facts[`score.${s.instrument}.total`] = s.total;
    facts[`score.${s.instrument}.band`] = s.band;
    if (s.positive !== undefined) facts[`score.${s.instrument}.positive`] = s.positive;
    if (s.acute !== undefined) facts[`score.${s.instrument}.acute`] = s.acute;
  }
  return facts;
}
