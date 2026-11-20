import "server-only";
import { db } from "@/lib/db/server";
import { sessionIdsInScope, type Scope } from "@/lib/staff/scope";

// Service insights for the care-team console: how many people came in, how
// fast the team responded, and how the AI and the rules behaved. Read-only,
// computed from data the app already stores. Callers must have passed requireStaff().

export const INSIGHT_DAYS = 30;
const CHART_DAYS = 14;
const TZ = "Asia/Dubai";

function rows<T>(result: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return (result.data ?? []) as T[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const dayLabel = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(d);

const TIER_GROUPS = [
  { id: "imminent", label: "Imminent", target: "15 minutes", tiers: ["imminent"] },
  { id: "urgent", label: "Urgent", target: "4 hours", tiers: ["urgent"] },
  { id: "routine", label: "Routine", target: "1 working day", tiers: ["elevated", "normal"] },
];

export async function loadInsights(scope: Scope, now = new Date()) {
  const since = new Date(now.getTime() - INSIGHT_DAYS * 86_400_000).toISOString();
  // Only cases in scope: the guest sees demo cases, real staff never do.
  const inScope = await sessionIdsInScope(scope);
  const mine = <T extends { session_id: string | null }>(list: T[]) => list.filter((r) => r.session_id !== null && inScope.has(r.session_id));
  const [allSessions, allEvents, allFlags, allTasks, allDecisions, allReferrals] = await Promise.all([
    db().from("sessions").select("id, path, created_at, taken_over").gte("created_at", since).limit(5000)
      .then((r) => rows<{ id: string; path: string; created_at: string; taken_over: boolean }>(r, "sessions")),
    db().from("audit_events").select("action, session_id, metadata")
      .in("action", ["check_in_completed", "summary_signed", "ai_reply_blocked", "ai_unavailable_fallback", "safety_check_asked"])
      .gte("created_at", since).limit(10000)
      .then((r) => rows<{ action: string; session_id: string | null; metadata: Record<string, unknown> }>(r, "events")),
    db().from("red_flag_events").select("session_id, rule_id, tier").gte("created_at", since).limit(5000)
      .then((r) => rows<{ session_id: string; rule_id: string; tier: string }>(r, "red flags")),
    db().from("tasks").select("session_id, type, priority, created_at, due_at, acknowledged_at").gte("created_at", since).limit(5000)
      .then((r) => rows<{ session_id: string; type: string; priority: string; created_at: string; due_at: string; acknowledged_at: string | null }>(r, "tasks")),
    db().from("clinician_decisions").select("action, triage_proposals!inner(session_id)").gte("created_at", since).limit(5000)
      .then((r) => rows<{ action: string; triage_proposals: { session_id: string } }>(r, "decisions")),
    db().from("receipt_events").select("session_id, service_id").eq("status", "booked").not("service_id", "is", null).gte("created_at", since).limit(5000)
      .then((r) => rows<{ session_id: string; service_id: string }>(r, "referrals")),
  ]);
  const sessions = allSessions.filter((s) => inScope.has(s.id));
  const events = mine(allEvents);
  const flags = mine(allFlags);
  const tasks = mine(allTasks);
  const decisions = allDecisions.filter((d) => inScope.has(d.triage_proposals.session_id));
  const referrals = mine(allReferrals);

  const checkIns = sessions.filter((s) => s.path !== "contact");
  const completedEvents = events.filter((e) => e.action === "check_in_completed");
  const completed = new Set(completedEvents.map((e) => e.session_id)).size;
  const sentToClinician = new Set(completedEvents.filter((e) => e.metadata?.sent_to_clinician === true).map((e) => e.session_id)).size;
  const count = (action: string) => events.filter((e) => e.action === action).length;

  // Check-ins per day for the chart, oldest first, including empty days.
  const perDay = new Map<string, number>();
  for (const s of checkIns) perDay.set(dayKey(new Date(s.created_at)), (perDay.get(dayKey(new Date(s.created_at))) ?? 0) + 1);
  const daily = Array.from({ length: CHART_DAYS }, (_, i) => {
    const d = new Date(now.getTime() - (CHART_DAYS - 1 - i) * 86_400_000);
    return { label: dayLabel(d), value: perDay.get(dayKey(d)) ?? 0 };
  });

  const byRule = new Map<string, { rule: string; tier: string; n: number }>();
  for (const f of flags) {
    const row = byRule.get(f.rule_id) ?? { rule: f.rule_id, tier: f.tier, n: 0 };
    row.n += 1;
    byRule.set(f.rule_id, row);
  }

  // Response times: from the task being raised to a clinician acknowledging it.
  const response = TIER_GROUPS.map((g) => {
    const group = tasks.filter((t) => g.tiers.includes(t.priority));
    const acked = group.filter((t) => t.acknowledged_at);
    const minutes = acked.map((t) => (new Date(t.acknowledged_at!).getTime() - new Date(t.created_at).getTime()) / 60_000);
    const onTime = acked.filter((t) => t.acknowledged_at! <= t.due_at).length;
    const waitingOverdue = group.filter((t) => !t.acknowledged_at && t.due_at < now.toISOString()).length;
    return { ...g, raised: group.length, acknowledged: acked.length, medianMinutes: median(minutes), onTime, waitingOverdue };
  });

  const reviewSeconds = events
    .filter((e) => e.action === "summary_signed" && typeof e.metadata?.review_seconds === "number")
    .map((e) => e.metadata.review_seconds as number);

  return {
    days: INSIGHT_DAYS,
    started: checkIns.length,
    completed,
    sentToClinician,
    callbacks: tasks.filter((t) => t.type === "talk_to_person" || t.type === "callback").length,
    quick: checkIns.filter((s) => s.path === "quick").length,
    full: checkIns.filter((s) => s.path === "full").length,
    followUps: checkIns.filter((s) => s.path === "followup").length,
    takenOver: sessions.filter((s) => s.taken_over).length,
    daily,
    flagsByRule: [...byRule.values()].sort((a, b) => b.n - a.n),
    flagsTotal: flags.length,
    response,
    reviewMedianSeconds: median(reviewSeconds),
    reviewsSigned: reviewSeconds.length,
    accepted: decisions.filter((d) => d.action === "accept").length,
    overridden: decisions.filter((d) => d.action === "override").length,
    referrals: Object.entries(
      referrals.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.service_id]: (acc[r.service_id] ?? 0) + 1 }), {}),
    ).sort((a, b) => b[1] - a[1]),
    aiBlocked: count("ai_reply_blocked"),
    aiFallback: count("ai_unavailable_fallback"),
    safetyChecks: count("safety_check_asked"),
  };
}

export type Insights = Awaited<ReturnType<typeof loadInsights>>;
