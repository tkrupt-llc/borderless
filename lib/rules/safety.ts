import type { Action, RiskTier, Rule, RuleFile } from "@/lib/contracts/rules";
import { runRules, type Facts } from "./engine";
import { highestTier } from "./tiers";

export type SafetyResult = {
  /** Rules that fired, in the order checked (red flags first). */
  fired: Rule[];
  firedRuleIds: string[];
  actions: Action[];
  takeover: boolean;
  /** Highest tier of any task the rules create; null if none. */
  tier: RiskTier | null;
};

/** Runs the red-flag rules and the BPD/ADHD rules together. Pure: rule files are passed in. */
export function runSafetyRules(files: { redFlags: RuleFile; bpdAdhd: RuleFile }, facts: Facts): SafetyResult {
  const results = [runRules(files.redFlags, facts), runRules(files.bpdAdhd, facts)];
  const fired: Rule[] = results.flatMap((r) => r.fired);
  const actions = results.flatMap((r) => r.actions);
  return {
    fired,
    firedRuleIds: fired.map((r) => r.id),
    actions,
    takeover: results.some((r) => r.takeover),
    tier: highestTier(actions),
  };
}
