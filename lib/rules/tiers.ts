import type { Action, RiskTier } from "@/lib/contracts/rules";

/** Highest first. A tier can only be raised by another rule, never lowered. */
const ORDER: readonly RiskTier[] = ["imminent", "urgent", "elevated"];

/** The highest tier among all create_task actions, or null if none. */
export function highestTier(actions: Action[]): RiskTier | null {
  const tiers = new Set(actions.flatMap((a) => (a.action === "create_task" ? [a.tier] : [])));
  return ORDER.find((t) => tiers.has(t)) ?? null;
}

/** Response clocks from the spec (final values set by the psychiatrist and pilot site). */
export function dueAt(tier: RiskTier, from: Date): Date {
  switch (tier) {
    case "imminent":
      return new Date(from.getTime() + 15 * 60_000);
    case "urgent":
      return new Date(from.getTime() + 4 * 60 * 60_000);
    case "elevated":
      return nextWorkingDay(from);
  }
}

/** Same time on the next working day (UAE week: Monday to Friday). */
export function nextWorkingDay(from: Date): Date {
  const d = new Date(from);
  do d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}
