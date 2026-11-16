import type { RuleFile } from "@/lib/contracts/rules";
import { runRules, type Facts } from "./engine";

export const STEP_NAMES = [
  "Self-help",
  "Community or counsellor",
  "Primary care",
  "Psychologist or tele-mental health",
  "Psychiatrist",
] as const;

export type Proposal = {
  /** null when no routing rule matched (e.g. nothing was scored). */
  step: number | null;
  ruleIds: string[];
  reasons: string[];
  rulesetVersion: string;
};

/**
 * The proposed step is the highest step any rule proposes, limited by the
 * lowest cap. Deterministic; a clinician accepts or overrides it.
 */
export function proposeStep(file: RuleFile, facts: Facts): Proposal {
  const { fired } = runRules(file, facts);
  const steps: number[] = [];
  const caps: number[] = [];
  for (const rule of fired) {
    for (const a of rule.then) {
      if (a.action === "propose_step") steps.push(a.step);
      if (a.action === "cap_step") caps.push(a.maxStep);
    }
  }
  const step = steps.length ? Math.min(Math.max(...steps), ...(caps.length ? caps : [4])) : null;
  return {
    step,
    ruleIds: fired.map((r) => r.id),
    reasons: fired.map((r) => r.description),
    rulesetVersion: file.version,
  };
}
