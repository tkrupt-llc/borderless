/**
 * "Prefer not to say" (design canvas, Trust, privacy and choice).
 *
 * A skipped question is stored as SKIPPED (-1) so the clinician sees it was
 * offered and declined. It is never scored: scoring only sees real answers, and
 * a questionnaire with a skipped item gets no total (scoring.ts never guesses).
 *
 * Safety questions cannot be skipped. Every item a red-flag rule reads stays
 * required until the psychiatrist confirms how a skipped safety question should
 * route (canvas note: "Psychiatrist to confirm"). tests/skip.test.ts checks this
 * list against red-flags.yaml.
 */

export const SKIPPED = -1;

const SAFETY_PREFIXES = ["QC_SUICIDE-", "ASQ-", "CSSRS_SCREENER-", "RED_FLAG-"];

export function canSkip(itemId: string): boolean {
  return itemId !== "PHQ9-9" && !SAFETY_PREFIXES.some((p) => itemId.startsWith(p));
}

/** Splits stored answers into real answers (scored, read by rules) and skipped item ids. */
export function splitSkips(all: Record<string, number>): { answers: Record<string, number>; skipped: string[] } {
  const answers: Record<string, number> = {};
  const skipped: string[] = [];
  for (const [id, v] of Object.entries(all)) {
    if (v === SKIPPED) skipped.push(id);
    else answers[id] = v;
  }
  return { answers, skipped };
}
