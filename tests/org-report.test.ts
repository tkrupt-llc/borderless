import { describe, expect, it } from "vitest";
import { cell, cellText, groupCounts, MIN_GROUP, orgReport, share, type OrgSession } from "@/lib/outcomes/aggregate";
import { computeOutcomes, type OutcomeSession } from "@/lib/outcomes/metrics";

const sessions = (orgId: string, n: number, path = "quick", referred = false): OrgSession[] =>
  Array.from({ length: n }, (_, i) => ({ orgId, path, createdAt: `2026-11-${String((i % 28) + 1).padStart(2, "0")}T09:00:00Z`, referred }));

describe("aggregate-only employer and university views", () => {
  it("uses a minimum group size of 10", () => {
    expect(MIN_GROUP).toBe(10);
    expect(cell(9)).toEqual({ suppressed: true });
    expect(cell(10)).toEqual({ suppressed: false, n: 10 });
    expect(cellText(cell(3))).toBe("fewer than 10");
  });

  it("shows nothing but 'fewer than 10' when under 10 people used it", () => {
    const r = orgReport(sessions("acme", 9), "acme");
    expect(r.total.suppressed).toBe(true);
    expect(r.byPath).toEqual([]);
    expect(r.referredShare.suppressed).toBe(true);
  });

  it("shows totals for 10 or more, and suppresses any smaller group inside", () => {
    const r = orgReport([...sessions("acme", 25, "quick"), ...sessions("acme", 3, "full")], "acme");
    expect(r.total).toEqual({ suppressed: false, n: 28 });
    expect(r.byPath).toContainEqual({ group: "Quick check", count: { suppressed: false, n: 25 } });
    expect(r.byPath).toContainEqual({ group: "Full check-in", count: { suppressed: true } });
  });

  it("counts only its own organisation", () => {
    const r = orgReport([...sessions("acme", 12), ...sessions("other", 50)], "acme");
    expect(r.total).toEqual({ suppressed: false, n: 12 });
  });

  it("never contains anything about a person: no ids, answers, scores or flags", () => {
    const r = orgReport([...sessions("acme", 30, "quick", true), ...sessions("acme", 20)], "acme");
    const json = JSON.stringify(r);
    for (const word of ["sessionId", "\"id\"", "answer", "score", "flag", "createdAt", "2026-"]) expect(json).not.toContain(word);
  });

  it("hides a share when the part or the rest is a small group (so it can't be worked out)", () => {
    expect(share(9, 40)).toEqual({ suppressed: true });
    expect(share(35, 40)).toEqual({ suppressed: true }); // the other 5 could be worked out
    expect(share(20, 40)).toEqual({ suppressed: false, pct: 50 });
    expect(share(5, 8)).toEqual({ suppressed: true });
  });

  it("groups missing values as 'Not given' and suppresses small groups", () => {
    const g = groupCounts([...Array(12).fill({ e: "Abu Dhabi" }), ...Array(4).fill({ e: null })], (r: { e: string | null }) => r.e);
    expect(g).toEqual([
      { group: "Abu Dhabi", count: { suppressed: false, n: 12 } },
      { group: "Not given", count: { suppressed: true } },
    ]);
  });
});

describe("fairness breakdowns on the service overview", () => {
  it("suppresses groups under 10 for every dimension, including emirate", () => {
    const people: OutcomeSession[] = [
      ...Array.from({ length: 12 }, (_, i) => ({ id: `a${i}`, emirate: "Abu Dhabi" })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `d${i}`, emirate: "Dubai" })),
    ].map((p) => ({ ...p, path: "quick", parentId: null, createdAt: "2026-11-01T09:00:00Z", statsConsent: true, age: null, gender: null, nationality: null, language: null }));
    const out = computeOutcomes({ sessions: people, receipt: [], scores: [], crisisTasks: [], adverse: [] });
    const emirate = out.fairness.find((f) => f.dim === "emirate")!;
    expect(emirate.groups.find((g) => g.group === "Abu Dhabi")!.count).toEqual({ suppressed: false, n: 12 });
    expect(emirate.groups.find((g) => g.group === "Dubai")!.count).toEqual({ suppressed: true });
    expect(out.fairness.map((f) => f.dim)).toEqual(["age", "gender", "nationality", "language", "emirate"]);
  });
});

describe("outcome measures", () => {
  const s = (id: string, extra: Partial<OutcomeSession> = {}): OutcomeSession => ({
    id, path: "quick", parentId: null, createdAt: "2026-11-01T09:00:00Z", statsConsent: true,
    age: null, gender: null, nationality: null, language: null, emirate: null, ...extra,
  });

  it("computes screen-to-first-contact, hand-off, waiting time and reliable improvement", () => {
    const out = computeOutcomes({
      sessions: [s("a"), s("b"), s("f", { path: "followup", parentId: "a", createdAt: "2026-11-29T09:00:00Z" })],
      receipt: [
        { sessionId: "a", status: "spoke", createdAt: "2026-11-01T13:00:00Z" },
        { sessionId: "a", status: "referred", createdAt: "2026-11-02T09:00:00Z" },
        { sessionId: "a", status: "booked", createdAt: "2026-11-05T09:00:00Z" },
        { sessionId: "a", status: "first_contact_confirmed", createdAt: "2026-11-06T09:00:00Z" },
        { sessionId: "b", status: "referred", createdAt: "2026-11-02T09:00:00Z" },
      ],
      scores: [
        { sessionId: "a", instrument: "PHQ9", total: 18 },
        { sessionId: "f", instrument: "PHQ9", total: 10 },
      ],
      crisisTasks: [{ createdAt: "2026-11-01T09:00:00Z", dueAt: "2026-11-01T13:00:00Z", acknowledgedAt: "2026-11-01T10:00:00Z" }],
      adverse: [{ category: "care_delay", severity: "low" }],
    });
    expect(out.screenToFirstContactHours).toBe(4);
    expect(out.handOff).toEqual({ done: 1, of: 2 });
    expect(out.waitDays).toBe(3);
    expect(out.followUpOnTime).toEqual({ done: 1, of: 1 });
    expect(out.reliableImprovement).toEqual({ done: 1, of: 1 });
    expect(out.crisis).toEqual({ done: 1, of: 1 });
    expect(out.adverse.total).toBe(1);
  });
});
