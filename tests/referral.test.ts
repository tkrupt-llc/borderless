import { describe, expect, it } from "vitest";
import { dueActions, FOLLOW_UP_CONFIG, patientCard, type Referral } from "@/lib/referral/followup";
import { computeOutcomes } from "@/lib/outcomes/metrics";

const base: Referral = {
  status: "referred",
  urgent: false,
  referredAt: "2026-11-10T09:00:00Z",
  bookedFor: null,
  bookedAt: null,
  firstContactAt: null,
  reminderAt: null,
  helpRequestedAt: null,
  stalledAt: null,
  attendanceAskedAt: null,
  urgentRequeuedAt: null,
};
const at = (iso: string) => new Date(iso);
const days = (n: number) => new Date(new Date(base.referredAt).getTime() + n * 86_400_000);

describe("referral follow-up rules (configurable)", () => {
  it("uses the configured timings", () => {
    expect(FOLLOW_UP_CONFIG).toMatchObject({ reminderAfterDays: 3, stallAfterDays: 7, attendanceCheckAfterBookedDays: 2, urgentRequeueHours: 48 });
  });

  it("does nothing in the first 3 days", () => {
    expect(dueActions(base, days(2.9))).toEqual([]);
  });

  it("reminds at 3 days unbooked, once", () => {
    expect(dueActions(base, days(3))).toEqual(["remind"]);
    expect(dueActions({ ...base, reminderAt: days(3).toISOString() }, days(4))).toEqual([]);
  });

  it("stalls at 7 days unbooked, back to the queue, once", () => {
    const reminded = { ...base, reminderAt: days(3).toISOString() };
    expect(dueActions(reminded, days(7))).toEqual(["stall"]);
    expect(dueActions({ ...reminded, stalledAt: days(7).toISOString() }, days(9))).toEqual([]);
  });

  it("stops the unbooked rules once booked", () => {
    expect(dueActions({ ...base, status: "booked", bookedAt: days(1).toISOString(), bookedFor: "2026-11-20" }, days(8))).toEqual([]);
  });

  it("asks 'Did you see them?' 2 days after the booked date", () => {
    const booked: Referral = { ...base, status: "booked", bookedAt: days(1).toISOString(), bookedFor: "2026-11-15" };
    expect(dueActions(booked, at("2026-11-16T12:00:00+04:00"))).toEqual([]);
    expect(dueActions(booked, at("2026-11-17T00:00:00+04:00"))).toEqual(["ask_attendance"]);
    expect(dueActions({ ...booked, attendanceAskedAt: "2026-11-17T01:00:00Z" }, at("2026-11-18T00:00:00+04:00"))).toEqual([]);
  });

  it("returns urgent referrals to the queue after 48 hours without progress, once per stage", () => {
    const urgent = { ...base, urgent: true };
    expect(dueActions(urgent, days(1.9))).toEqual([]);
    expect(dueActions(urgent, days(2))).toEqual(["urgent_requeue"]);
    const requeued = { ...urgent, urgentRequeuedAt: days(2).toISOString() };
    expect(dueActions(requeued, days(2.5))).toEqual([]);
    // A new stage (booked) restarts the 48-hour clock.
    const booked = { ...requeued, status: "booked" as const, bookedAt: days(2.2).toISOString(), bookedFor: "2026-11-30" };
    expect(dueActions(booked, days(4.1))).toEqual([]);
    expect(dueActions(booked, days(4.3))).toEqual(["urgent_requeue"]);
  });

  it("applies to urgent cases at every stage, including after first contact", () => {
    const fc: Referral = { ...base, urgent: true, status: "first_contact", firstContactAt: days(1).toISOString() };
    expect(dueActions(fc, days(3.1))).toEqual(["urgent_requeue"]);
  });

  it("does nothing once closed", () => {
    expect(dueActions({ ...base, status: "closed", urgent: true }, days(30))).toEqual([]);
  });
});

describe("the patient's 'Your next step' card", () => {
  it("asks 'Have you booked?', with a reminder from day 3", () => {
    expect(patientCard(base, days(1))).toEqual({ kind: "ask_booked", reminder: false });
    expect(patientCard(base, days(3))).toEqual({ kind: "ask_booked", reminder: true });
  });

  it("says help is coming after 'I need help booking'", () => {
    expect(patientCard({ ...base, helpRequestedAt: days(1).toISOString() }, days(1))).toEqual({ kind: "help_requested" });
  });

  it("shows the booked date, then asks 'Did you see them?'", () => {
    const booked: Referral = { ...base, status: "booked", bookedAt: days(1).toISOString(), bookedFor: "2026-11-15" };
    expect(patientCard(booked, at("2026-11-15T10:00:00+04:00"))).toEqual({ kind: "booked", bookedFor: "2026-11-15" });
    expect(patientCard(booked, at("2026-11-17T10:00:00+04:00"))).toEqual({ kind: "ask_attended", bookedFor: "2026-11-15" });
  });

  it("is done after first contact", () => {
    expect(patientCard({ ...base, status: "first_contact", firstContactAt: days(2).toISOString() }, days(3))).toEqual({ kind: "done" });
  });
});

describe("stalled hand-offs on the service overview", () => {
  it("counts stalled referrals among consenting people", () => {
    const s = (id: string, statsConsent = true) => ({
      id, path: "quick", parentId: null, createdAt: "2026-11-01T09:00:00Z", statsConsent, age: null, gender: null, nationality: null, language: null, emirate: null,
    });
    const out = computeOutcomes({
      sessions: [s("a"), s("b"), s("c", false)],
      receipt: [
        { sessionId: "a", status: "referred", createdAt: "2026-11-02T09:00:00Z" },
        { sessionId: "b", status: "referred", createdAt: "2026-11-02T09:00:00Z" },
      ],
      scores: [],
      crisisTasks: [],
      adverse: [],
      stalledReferrals: [{ sessionId: "a" }, { sessionId: "c" }],
    });
    expect(out.stalled).toEqual({ n: 1, of: 2 });
  });
});
