import { score, type Score } from "@/lib/rules/scoring";

/**
 * Follow-up rules. Deterministic, never AI. Thresholds are DRAFTS for the
 * psychiatrist to approve.
 *
 * - PHQ-2 and GAD-2 are the first two items of PHQ-9 and GAD-7, so a follow-up
 *   (which asks the full PHQ-9 and GAD-7) also yields them. That lets a quick
 *   check-in be compared with a later follow-up like for like.
 * - "Not on track" uses reliable-change sizes used in NHS Talking Therapies:
 *   PHQ-9 up by 6 or more, GAD-7 up by 5 or more. For the two-item screens,
 *   moving from negative to positive counts.
 */

export const FOLLOW_UP_DAYS = 28;
export const RELIABLE_WORSENING: Record<string, number> = { PHQ9: 6, GAD7: 5 };

/** PHQ-2 / GAD-2 worked out from the first two PHQ-9 / GAD-7 answers. */
export function derivedScreens(answers: Record<string, number>): Score[] {
  const phq2 = score("PHQ2", { "PHQ2-1": answers["PHQ9-1"], "PHQ2-2": answers["PHQ9-2"] });
  const gad2 = score("GAD2", { "GAD2-1": answers["GAD7-1"], "GAD2-2": answers["GAD7-2"] });
  return [phq2, gad2].filter((s): s is Score => s !== null);
}

type Point = { instrument: string; total: number; band: string };

/** Compares a follow-up with the check-in before it. Only like-for-like instruments are compared. */
export function notOnTrack(previous: Point[], now: Point[]): string[] {
  const reasons: string[] = [];
  for (const n of now) {
    const p = previous.find((x) => x.instrument === n.instrument);
    if (!p) continue;
    const limit = RELIABLE_WORSENING[n.instrument];
    if (limit !== undefined && n.total - p.total >= limit) {
      reasons.push(`${n.instrument} rose from ${p.total} to ${n.total} (by ${limit} or more)`);
    }
    if ((n.instrument === "PHQ2" || n.instrument === "GAD2") && p.band === "negative" && n.band === "positive") {
      reasons.push(`${n.instrument} moved from negative to positive (${p.total} to ${n.total})`);
    }
  }
  return reasons;
}

/** A random token for the private follow-up link (about 128 bits). */
export function newFollowUpToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,30}$/;
