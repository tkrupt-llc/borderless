import { describe, expect, it } from "vitest";
import { runSafetyRules } from "@/lib/rules/safety";
import { highestTier, dueAt } from "@/lib/rules/tiers";
import { parseRuleFile } from "@/lib/rules/parse";
import { readFileSync } from "node:fs";
import {
  canCloseCase,
  contactOverdue,
  isVisibleInQueue,
  needsCoSign,
  postCrisisCheckIns,
  supervisorTriggers,
  type ClosureState,
} from "@/lib/staff/safety-rules";
import { afterFailure, isLocked, LOCK_MINUTES, MAX_FAILED_ATTEMPTS, newReturnCode, normaliseCode, parseReference } from "@/lib/check/return-code";
import { notOnTrack, RELIABLE_IMPROVEMENT, RELIABLE_WORSENING } from "@/lib/followup/trend";

const redFlags = parseRuleFile(readFileSync("content/rules/red-flags.yaml", "utf8"));
const bpdAdhd = parseRuleFile(readFileSync("content/rules/bpd-adhd.yaml", "utf8"));
const tierFor = (facts: Record<string, boolean>) =>
  highestTier(runSafetyRules({ redFlags, bpdAdhd }, facts).fired.flatMap((r) => r.then));

// --- 1. "Alert my care team now" ---------------------------------------------------

describe("1. Alert my care team now", () => {
  it("creates an imminent task (15 minutes)", () => {
    expect(tierFor({ "flag.alert_care_team": true })).toBe("imminent");
    const from = new Date("2026-11-18T10:00:00Z");
    expect(dueAt("imminent", from).getTime() - from.getTime()).toBe(15 * 60_000);
  });

  it("opening the crisis page alone stays urgent", () => {
    expect(tierFor({ "flag.help_now": true })).toBe("urgent");
  });

  it("is imminent even when the page was already opened", () => {
    expect(tierFor({ "flag.help_now": true, "flag.alert_care_team": true })).toBe("imminent");
  });
});

// --- 4. Second escalation clock ------------------------------------------------------

describe("4. Imminent task acknowledged but no contact logged in 30 minutes", () => {
  const ack = "2026-11-18T10:00:00Z";
  const task = { priority: "imminent", createdAt: "2026-11-18T09:55:00Z", acknowledgedAt: ack, escalatedAt: null, closedAt: null };
  const at = (min: number) => new Date(new Date(ack).getTime() + min * 60_000);

  it("escalates at 30 minutes with no contact", () => {
    expect(contactOverdue(task, [], at(29))).toBe(false);
    expect(contactOverdue(task, [], at(30))).toBe(true);
  });

  it("does not escalate once a call attempt or conversation is logged after acknowledging", () => {
    expect(contactOverdue(task, [{ outcome: "called_no_answer", createdAt: "2026-11-18T10:10:00Z" }], at(45))).toBe(false);
    expect(contactOverdue(task, [{ outcome: "spoke", createdAt: "2026-11-18T10:20:00Z" }], at(45))).toBe(false);
  });

  it("ignores contact logged before the acknowledgement", () => {
    expect(contactOverdue(task, [{ outcome: "spoke", createdAt: "2026-11-18T09:58:00Z" }], at(31))).toBe(true);
  });

  it("only applies to acknowledged, open, not yet escalated imminent tasks", () => {
    expect(contactOverdue({ ...task, priority: "urgent" }, [], at(60))).toBe(false);
    expect(contactOverdue({ ...task, acknowledgedAt: null }, [], at(60))).toBe(false);
    expect(contactOverdue({ ...task, escalatedAt: ack }, [], at(60))).toBe(false);
    expect(contactOverdue({ ...task, closedAt: ack }, [], at(60))).toBe(false);
  });
});

// --- 5. Return path ------------------------------------------------------------------

describe("5. Coming back with a reference and return code", () => {
  it("makes readable 8-character codes without confusable letters", () => {
    for (let i = 0; i < 50; i++) {
      const code = newReturnCode();
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
      expect(normaliseCode(code)).toBe(code.replace("-", ""));
    }
  });

  it("accepts the code however it is typed", () => {
    expect(normaliseCode("k7qm 3xra")).toBe("K7QM3XRA");
    expect(normaliseCode("K7QM-3XRA")).toBe("K7QM3XRA");
    expect(normaliseCode("K7QM3XR")).toBeNull();
    expect(normaliseCode("O0I1L000")).toBeNull();
  });

  it("reads the reference in any common form", () => {
    expect(parseReference("BL-AF09B5")).toBe("af09b5");
    expect(parseReference("bl af09b5")).toBe("af09b5");
    expect(parseReference("AF09B5")).toBe("af09b5");
    expect(parseReference("BL-XYZ")).toBeNull();
  });

  it("locks for 15 minutes after 5 wrong codes", () => {
    const now = new Date("2026-11-18T10:00:00Z");
    let state = { failed: 0, lockedUntil: null as string | null };
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      state = afterFailure(state.failed, now);
      expect(state.lockedUntil).toBeNull();
    }
    state = afterFailure(state.failed, now);
    expect(isLocked(state.lockedUntil, now)).toBe(true);
    expect(isLocked(state.lockedUntil, new Date(now.getTime() + LOCK_MINUTES * 60_000 + 1))).toBe(false);
  });
});

// --- 7. Case closure ------------------------------------------------------------------

describe("7. Case closure", () => {
  const ready: ClosureState = {
    summarySigned: true,
    steps: { level: true, contact: true, handoff: true },
    openSafetyFlags: 0,
    urgentHandoffStalled: false,
    hadCrisis: false,
  };

  it("closes when everything is done and a reason is given", () => {
    expect(canCloseCase(ready, "handed_off", [])).toEqual({ ok: true, blockers: [] });
  });

  it("requires a valid closure reason", () => {
    expect(canCloseCase(ready, null, []).ok).toBe(false);
    expect(canCloseCase(ready, "because", []).ok).toBe(false);
  });

  it("requires a signed summary, which can't be marked not needed", () => {
    const r = canCloseCase({ ...ready, summarySigned: false }, "declined", ["level", "contact", "handoff"]);
    expect(r.ok).toBe(false);
    expect(r.blockers).toContain("Sign the summary");
  });

  it("allows a step to be marked not needed instead of done", () => {
    const state = { ...ready, steps: { level: true, contact: false, handoff: true } };
    expect(canCloseCase(state, "unreachable", []).ok).toBe(false);
    expect(canCloseCase(state, "unreachable", ["contact"]).ok).toBe(true);
  });

  it("is blocked while a safety flag is open", () => {
    expect(canCloseCase({ ...ready, openSafetyFlags: 1 }, "handed_off", []).ok).toBe(false);
  });

  it("is blocked while an urgent hand-off is stalled", () => {
    expect(canCloseCase({ ...ready, urgentHandoffStalled: true }, "handed_off", []).ok).toBe(false);
  });

  it("schedules check-ins at 7 and 30 days only after a crisis", () => {
    const closed = new Date("2026-11-18T10:00:00Z");
    expect(postCrisisCheckIns(closed, false)).toEqual([]);
    const [d7, d30] = postCrisisCheckIns(closed, true);
    expect(d7.toISOString()).toBe("2026-11-25T10:00:00.000Z");
    expect(d30.toISOString()).toBe("2026-12-18T10:00:00.000Z");
  });

  it("keeps scheduled check-ins out of the queue until a day before they're due", () => {
    const now = new Date("2026-11-18T10:00:00Z");
    expect(isVisibleInQueue({ type: "post_crisis_checkin", dueAt: "2026-11-25T10:00:00Z" }, now)).toBe(false);
    expect(isVisibleInQueue({ type: "post_crisis_checkin", dueAt: "2026-11-19T09:00:00Z" }, now)).toBe(true);
    expect(isVisibleInQueue({ type: "care_request", dueAt: "2026-12-30T10:00:00Z" }, now)).toBe(true);
  });
});

// --- 3 and 8 ------------------------------------------------------------------------------

describe("3. One set of change thresholds", () => {
  it("uses PHQ-9 6 and GAD-7 4 for both improvement and not on track", () => {
    expect(RELIABLE_IMPROVEMENT).toEqual({ PHQ9: 6, GAD7: 4 });
    expect(RELIABLE_WORSENING).toEqual({ PHQ9: 6, GAD7: 4 });
    expect(notOnTrack([{ instrument: "GAD7", total: 8, band: "mild" }], [{ instrument: "GAD7", total: 12, band: "moderate" }])).toHaveLength(1);
    expect(notOnTrack([{ instrument: "GAD7", total: 8, band: "mild" }], [{ instrument: "GAD7", total: 11, band: "moderate" }])).toHaveLength(0);
  });
});

describe("8. Supervisor triggers", () => {
  const now = new Date("2026-11-18T10:00:00Z");
  it("needs a co-sign when urgency is lowered on a safety-flagged case", () => {
    expect(needsCoSign({ hasRedFlag: true, proposalUrgent: true, decision: "override" })).toBe(true);
    expect(needsCoSign({ hasRedFlag: true, proposalUrgent: true, decision: "accept" })).toBe(false);
    expect(needsCoSign({ hasRedFlag: false, proposalUrgent: false, decision: "override" })).toBe(false);
  });

  it("flags a repeat crisis: 2+ urgent or imminent alerts in 30 days", () => {
    const alert = (daysAgo: number, priority = "urgent") => ({ priority, createdAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString() });
    expect(supervisorTriggers({ crisisAlerts: [alert(2), alert(10, "imminent")], hasImminent: false, contacts: [] }, now).map((t) => t.key)).toEqual(["repeat_crisis"]);
    expect(supervisorTriggers({ crisisAlerts: [alert(2), alert(40)], hasImminent: false, contacts: [] }, now)).toEqual([]);
  });

  it("flags an imminent case unreachable after 2 call attempts", () => {
    const miss = (min: number) => ({ outcome: "called_no_answer" as const, createdAt: new Date(now.getTime() - min * 60_000).toISOString() });
    expect(supervisorTriggers({ crisisAlerts: [], hasImminent: true, contacts: [miss(20), miss(5)] }, now).map((t) => t.key)).toEqual(["imminent_unreachable"]);
    // A conversation after the misses clears it.
    expect(supervisorTriggers({ crisisAlerts: [], hasImminent: true, contacts: [miss(20), miss(5), { outcome: "spoke", createdAt: now.toISOString() }] }, now)).toEqual([]);
  });
});
