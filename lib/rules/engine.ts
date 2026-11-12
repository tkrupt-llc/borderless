import type { Action, Condition, Rule, RuleFile } from "@/lib/contracts/rules";

/** Session facts the rules read, e.g. { "item.PHQ9.9": 2, "answer.QC_SUICIDE.1": true }. */
export type Facts = Record<string, number | boolean | string | undefined>;

/**
 * Builds facts from questionnaire answers keyed by item id ("PHQ9-9" -> 2).
 *   item.<INSTRUMENT>.<n>   the numeric answer value
 *   answer.<INSTRUMENT>.<n> true when the answer is above zero ("yes" / any symptom)
 */
export function factsFromAnswers(answers: Record<string, number>): Facts {
  const facts: Facts = {};
  for (const [itemId, value] of Object.entries(answers)) {
    const match = /^([A-Z0-9_]+)-(\d+)$/.exec(itemId);
    if (!match) continue;
    const [, instrument, n] = match;
    facts[`item.${instrument}.${n}`] = value;
    facts[`answer.${instrument}.${n}`] = value > 0;
  }
  return facts;
}

/** A missing fact never matches, so an unanswered item cannot fire or block a rule. */
export function evaluate(condition: Condition, facts: Facts): boolean {
  if ("all" in condition) return condition.all.every((c) => evaluate(c, facts));
  if ("any" in condition) return condition.any.some((c) => evaluate(c, facts));

  const actual = facts[condition.fact];
  if (actual === undefined) return false;
  const expected = condition.value;
  switch (condition.op) {
    case "==":
      return actual === expected;
    case "!=":
      return actual !== expected;
    case ">":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case ">=":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "<":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "<=":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
  }
}

export type RuleResult = { fired: Rule[]; actions: Action[]; takeover: boolean };

/** Runs every rule in the file; all matching rules fire, in file order. */
export function runRules(file: RuleFile, facts: Facts): RuleResult {
  const fired = file.rules.filter((rule) => evaluate(rule.when, facts));
  const actions = fired.flatMap((rule) => rule.then);
  return { fired, actions, takeover: actions.some((a) => a.action === "takeover_session") };
}
