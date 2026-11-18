import { FOLLOW_UP_DAYS, RELIABLE_IMPROVEMENT as IMPROVEMENT } from "@/lib/followup/trend";
import { groupCounts, rate, MIN_GROUP } from "./aggregate";

/**
 * Service outcome measures (challenge brief), from plain rows so they are
 * tested without a database. Deterministic; nothing here uses AI.
 */

export type OutcomeSession = {
  id: string;
  path: string;
  parentId: string | null;
  createdAt: string;
  statsConsent: boolean;
  age: string | null;
  gender: string | null;
  nationality: string | null;
  language: string | null;
  emirate: string | null;
};
export type OutcomeInput = {
  sessions: OutcomeSession[];
  receipt: { sessionId: string; status: string; createdAt: string }[];
  scores: { sessionId: string; instrument: string; total: number }[];
  crisisTasks: { createdAt: string; dueAt: string; acknowledgedAt: string | null }[];
  adverse: { category: string; severity: string }[];
  /** Referrals that went back to the queue as "Hand-off stalled" (not booked in time, help asked, or not seen). */
  stalledReferrals?: { sessionId: string }[];
};

const hours = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Reliable improvement: a drop at least as large as the threshold in content/rules/change-thresholds.json. */
export const RELIABLE_IMPROVEMENT = IMPROVEMENT;

export const FAIRNESS_DIMENSIONS = [
  { id: "age", label: "Age band" },
  { id: "gender", label: "Gender" },
  { id: "nationality", label: "Nationality" },
  { id: "language", label: "Language" },
  { id: "emirate", label: "Emirate" },
] as const;

export function computeOutcomes(input: OutcomeInput) {
  // Only people who agreed to anonymous service statistics are counted.
  const counted = input.sessions.filter((s) => s.statsConsent);
  const ids = new Set(counted.map((s) => s.id));
  const byId = new Map(counted.map((s) => [s.id, s]));
  const events = input.receipt.filter((e) => ids.has(e.sessionId));
  const first = (sid: string, statuses: string[]) =>
    events.filter((e) => e.sessionId === sid && statuses.includes(e.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  // 1. Screen to first contact: check-in started -> first conversation with the care team.
  const toContact = counted
    .map((s) => ({ s, c: first(s.id, ["spoke", "first_contact_confirmed"]) }))
    .filter((x) => x.c)
    .map((x) => hours(x.s.createdAt, x.c!.createdAt));

  // 2. Successful hand-off: referred people who reached first contact with the service.
  const referred = counted.filter((s) => first(s.id, ["referred"]));
  const handedOff = referred.filter((s) => first(s.id, ["first_contact_confirmed"]));

  // 3. Follow-up on time: completed within a week of the 4-week due date.
  const followUps = counted.filter((s) => s.path === "followup" && s.parentId && byId.has(s.parentId));
  const onTime = followUps.filter((s) => hours(byId.get(s.parentId!)!.createdAt, s.createdAt) <= (FOLLOW_UP_DAYS + 7) * 24);

  // 4. Waiting time: referral -> booking, in days.
  const waits = referred
    .map((s) => ({ r: first(s.id, ["referred"])!, b: first(s.id, ["booked"]) }))
    .filter((x) => x.b && x.b.createdAt >= x.r.createdAt)
    .map((x) => hours(x.r.createdAt, x.b!.createdAt) / 24);

  // 5. Reliable improvement: first check-in vs its follow-up, same instrument.
  const scoreOf = (sid: string, inst: string) => input.scores.find((x) => x.sessionId === sid && x.instrument === inst)?.total;
  let improvable = 0;
  let improved = 0;
  for (const f of followUps) {
    const pairs = Object.keys(RELIABLE_IMPROVEMENT)
      .map((inst) => ({ inst, before: scoreOf(f.parentId!, inst), after: scoreOf(f.id, inst) }))
      .filter((p) => p.before !== undefined && p.after !== undefined);
    if (pairs.length === 0) continue;
    improvable += 1;
    if (pairs.some((p) => p.before! - p.after! >= RELIABLE_IMPROVEMENT[p.inst])) improved += 1;
  }

  // 6. Crisis responses completed: urgent and imminent alerts acknowledged within their clock.
  const crisisDone = input.crisisTasks.filter((t) => t.acknowledgedAt && t.acknowledgedAt <= t.dueAt).length;

  // Fairness: who reached first contact, by group. Groups under MIN_GROUP are suppressed.
  const reached = new Set(counted.filter((s) => first(s.id, ["spoke", "first_contact_confirmed"])).map((s) => s.id));
  const fairness = FAIRNESS_DIMENSIONS.map(({ id, label }) => ({
    dim: id,
    label,
    groups: groupCounts(counted, (s) => s[id]).map((g) => {
      const members = counted.filter((s) => (s[id] || "Not given") === g.group);
      return { group: g.group, count: g.count, reachedContact: rate(members.filter((m) => reached.has(m.id)).length, members.length) };
    }),
  }));

  return {
    counted: counted.length,
    excludedNoConsent: input.sessions.length - counted.length,
    screenToFirstContactHours: median(toContact),
    screenToFirstContactN: toContact.length,
    handOff: { done: handedOff.length, of: referred.length },
    followUpOnTime: { done: onTime.length, of: followUps.length },
    waitDays: median(waits),
    waitN: waits.length,
    reliableImprovement: { done: improved, of: improvable },
    crisis: { done: crisisDone, of: input.crisisTasks.length },
    adverse: { total: input.adverse.length, severe: input.adverse.filter((a) => a.severity === "severe").length },
    stalled: { n: (input.stalledReferrals ?? []).filter((r) => ids.has(r.sessionId)).length, of: referred.length },
    fairness,
    minGroup: MIN_GROUP,
  };
}
export type Outcomes = ReturnType<typeof computeOutcomes>;
