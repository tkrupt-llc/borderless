/**
 * Which questions are asked, given the answers so far. Pure, shared by the
 * question page (to find the next question) and the server (to check a
 * finished screen is complete). From the published instructions:
 * - ASQ item 5 (acuity) only after a "yes" to any of items 1-4.
 * - The C-SSRS screener only after a positive ASQ (red-flags.yaml, RF-ASQ-POSITIVE).
 * - C-SSRS items 3-5 only if item 2 is "yes"; item 7 only if item 6 is "yes".
 */

type Answers = Record<string, number>;

const yes = (a: Answers, id: string) => a[id] === 1;
export const asqPositive = (a: Answers) => [1, 2, 3, 4].some((n) => yes(a, `ASQ-${n}`));

const ASK_IF: Record<string, (a: Answers) => boolean> = {
  "ASQ-5": asqPositive,
  "CSSRS_SCREENER-1": asqPositive,
  "CSSRS_SCREENER-2": asqPositive,
  "CSSRS_SCREENER-3": (a) => asqPositive(a) && yes(a, "CSSRS_SCREENER-2"),
  "CSSRS_SCREENER-4": (a) => asqPositive(a) && yes(a, "CSSRS_SCREENER-2"),
  "CSSRS_SCREENER-5": (a) => asqPositive(a) && yes(a, "CSSRS_SCREENER-2"),
  "CSSRS_SCREENER-6": asqPositive,
  "CSSRS_SCREENER-7": (a) => asqPositive(a) && yes(a, "CSSRS_SCREENER-6"),
};

export function isAsked(itemId: string, answers: Answers): boolean {
  return ASK_IF[itemId]?.(answers) ?? true;
}

/** Index of the next question to ask after `from`, or null when the screen is done. */
export function nextAskedIndex(itemIds: string[], from: number, answers: Answers): number | null {
  for (let i = from + 1; i < itemIds.length; i++) if (isAsked(itemIds[i], answers)) return i;
  return null;
}

/** Every question that should have been asked has an answer. */
export function allAskedAnswered(itemIds: string[], answers: Answers): boolean {
  return itemIds.every((id) => !isAsked(id, answers) || answers[id] !== undefined);
}
