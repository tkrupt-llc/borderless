import { describe, expect, it } from "vitest";
import { formatOpening, isStaffed, nextStaffed, type Staffing } from "@/lib/staffing";
import { canCloseCase, canCloseRedFlag, coSignAllowed, contactOverdue, type ClosureState } from "@/lib/staff/safety-rules";

const uae = (iso: string) => new Date(`${iso}+04:00`);
// 2026-11-18 is a Wednesday.
const cfg: Staffing = { timezone: "Asia/Dubai", hours: { mon: [8, 20], tue: [8, 20], wed: [8, 20], thu: [8, 20], fri: [8, 20], sat: [9, 17] } };

// --- 1. Staffed hours ----------------------------------------------------------------------

describe("1. Staffed hours (UAE time)", () => {
  it("is staffed inside the configured hours and not outside", () => {
    expect(isStaffed(uae("2026-11-18T08:00:00"), cfg)).toBe(true);
    expect(isStaffed(uae("2026-11-18T19:59:00"), cfg)).toBe(true);
    expect(isStaffed(uae("2026-11-18T20:00:00"), cfg)).toBe(false);
    expect(isStaffed(uae("2026-11-18T07:59:00"), cfg)).toBe(false);
  });

  it("treats a day missing from the config as closed", () => {
    expect(isStaffed(uae("2026-11-22T12:00:00"), cfg)).toBe(false); // Sunday
  });

  it("finds when the team is next on duty", () => {
    expect(nextStaffed(uae("2026-11-18T21:30:00"), cfg).toISOString()).toBe(uae("2026-11-19T08:00:00").toISOString());
    expect(nextStaffed(uae("2026-11-21T18:00:00"), cfg).toISOString()).toBe(uae("2026-11-23T08:00:00").toISOString()); // Sat evening -> Mon
    const now = uae("2026-11-18T10:15:00");
    expect(nextStaffed(now, cfg)).toBe(now);
  });

  it("formats the opening time in UAE time for the patient", () => {
    expect(formatOpening(uae("2026-11-19T08:00:00"), cfg)).toMatch(/Thu.*8:00\s?am/i);
  });
});

// --- 3. Urgent: acknowledged, no contact by the reply-by time ------------------------------

describe("3. Urgent tasks acknowledged but with no contact by their reply-by time", () => {
  const task = {
    priority: "urgent",
    createdAt: "2026-11-18T10:00:00Z",
    dueAt: "2026-11-18T14:00:00Z",
    acknowledgedAt: "2026-11-18T10:30:00Z",
    escalatedAt: null,
    closedAt: null,
  };
  it("escalates at the reply-by time with no contact since acknowledging", () => {
    expect(contactOverdue(task, [], new Date("2026-11-18T13:59:00Z"))).toBe(false);
    expect(contactOverdue(task, [], new Date("2026-11-18T14:00:00Z"))).toBe(true);
  });
  it("does not escalate when a call attempt or conversation was logged", () => {
    expect(contactOverdue(task, [{ outcome: "called_no_answer", createdAt: "2026-11-18T11:00:00Z" }], new Date("2026-11-18T15:00:00Z"))).toBe(false);
  });
  it("does not apply before acknowledgement (the first clock handles that) or to routine tasks", () => {
    expect(contactOverdue({ ...task, acknowledgedAt: null }, [], new Date("2026-11-18T15:00:00Z"))).toBe(false);
    expect(contactOverdue({ ...task, priority: "normal" }, [], new Date("2026-11-20T15:00:00Z"))).toBe(false);
  });
});

// --- 4. Closing a red-flag task -------------------------------------------------------------

describe("4. Closing a red-flag task", () => {
  it("is allowed after a logged conversation, for anyone", () => {
    expect(canCloseRedFlag({ spokeLogged: true, isSupervisor: false, reason: null }).ok).toBe(true);
  });
  it("without a conversation, a clinician can't close it", () => {
    const r = canCloseRedFlag({ spokeLogged: false, isSupervisor: false, reason: "they're fine" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/conversation/);
  });
  it("without a conversation, a supervisor can sign it off, but only with a reason", () => {
    expect(canCloseRedFlag({ spokeLogged: false, isSupervisor: true, reason: "" }).ok).toBe(false);
    expect(canCloseRedFlag({ spokeLogged: false, isSupervisor: true, reason: "Seen in A&E today, confirmed by the hospital" }).ok).toBe(true);
  });
});

// --- 6. Four eyes ----------------------------------------------------------------------------

describe("6. A co-sign comes from a different person", () => {
  it("refuses a co-sign by the person who asked for it", () => {
    expect(coSignAllowed("user-a", "user-a")).toBe(false);
    expect(coSignAllowed("user-b", "user-a")).toBe(true);
  });
  it("refuses a co-sign with no request behind it", () => {
    expect(coSignAllowed("user-b", null)).toBe(false);
  });

  const crisis: ClosureState = {
    summarySigned: true,
    steps: { level: true, contact: true, handoff: true },
    openSafetyFlags: 0,
    urgentHandoffStalled: false,
    hadCrisis: true,
    contactAttempts: [],
    closingMessageSent: false,
    bySupervisor: true,
  };
  it("a supervisor can't close a crisis case as declined on their own request", () => {
    expect(canCloseCase({ ...crisis, coSignRequestedBy: "sup-1", currentUserId: "sup-1" }, "declined", []).ok).toBe(false);
    expect(canCloseCase({ ...crisis, coSignRequestedBy: null, currentUserId: "sup-1" }, "declined", []).ok).toBe(false);
  });
  it("closes when a clinician requested it and a different supervisor co-signs", () => {
    expect(canCloseCase({ ...crisis, coSignRequestedBy: "clin-1", currentUserId: "sup-1" }, "declined", [])).toEqual({ ok: true, blockers: [] });
  });
});
