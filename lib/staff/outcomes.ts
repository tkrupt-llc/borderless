import "server-only";
import { db } from "@/lib/db/server";
import { latestConsents, type ConsentRow } from "@/lib/consent";
import { computeOutcomes } from "@/lib/outcomes/metrics";
import { orgReport, type OrgSession } from "@/lib/outcomes/aggregate";

// Outcome measures for the service overview, and the aggregate-only view an
// employer or university sees. Callers must have passed requireStaff().

export const OUTCOME_DAYS = 90;

function rows<T>(result: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return (result.data ?? []) as T[];
}

type SessionRow = {
  id: string; path: string; parent_session_id: string | null; created_at: string; clinic_id: string | null;
  demo_age_band: string | null; demo_gender: string | null; demo_nationality: string | null; demo_language_variety: string | null; demo_emirate: string | null;
};

async function loadRows(now: Date) {
  const since = new Date(now.getTime() - OUTCOME_DAYS * 86_400_000).toISOString();
  const sessions = rows<SessionRow>(
    await db()
      .from("sessions")
      .select("id, path, parent_session_id, created_at, clinic_id, demo_age_band, demo_gender, demo_nationality, demo_language_variety, demo_emirate")
      .gte("created_at", since)
      .limit(10000),
    "sessions",
  );
  const ids = sessions.map((s) => s.id);
  const [consents, receipt, scores, tasks, adverse, stalled] = await Promise.all([
    db().from("consent_records").select("session_id, purpose, granted, created_at").eq("purpose", "service_improvement").gte("created_at", since).limit(20000)
      .then((r) => rows<ConsentRow & { session_id: string }>(r, "consents")),
    db().from("receipt_events").select("session_id, status, created_at").gte("created_at", since).limit(20000)
      .then((r) => rows<{ session_id: string; status: string; created_at: string }>(r, "receipt")),
    db().from("scores").select("session_id, instrument, total").gte("created_at", since).limit(20000)
      .then((r) => rows<{ session_id: string; instrument: string; total: number }>(r, "scores")),
    db().from("tasks").select("created_at, due_at, acknowledged_at").eq("type", "red_flag").in("priority", ["imminent", "urgent"]).gte("created_at", since).limit(10000)
      .then((r) => rows<{ created_at: string; due_at: string; acknowledged_at: string | null }>(r, "crisis tasks")),
    db().from("adverse_events").select("category, severity").gte("created_at", since).limit(5000)
      .then((r) => rows<{ category: string; severity: string }>(r, "adverse events")),
    db().from("referrals").select("session_id").not("stalled_at", "is", null).gte("referred_at", since).limit(10000)
      .then((r) => rows<{ session_id: string }>(r, "stalled referrals")),
  ]);
  const bySession = new Map<string, ConsentRow[]>();
  for (const c of consents) bySession.set(c.session_id, [...(bySession.get(c.session_id) ?? []), c]);
  const statsConsent = (id: string) => latestConsents(bySession.get(id) ?? []).service_improvement === true;
  return { sessions, ids, receipt, scores, tasks, adverse, stalled, statsConsent };
}

export async function loadOutcomes(now = new Date()) {
  const r = await loadRows(now);
  const outcomes = computeOutcomes({
    sessions: r.sessions.map((s) => ({
      id: s.id, path: s.path, parentId: s.parent_session_id, createdAt: s.created_at, statsConsent: r.statsConsent(s.id),
      age: s.demo_age_band, gender: s.demo_gender, nationality: s.demo_nationality, language: s.demo_language_variety, emirate: s.demo_emirate,
    })),
    receipt: r.receipt.map((e) => ({ sessionId: e.session_id, status: e.status, createdAt: e.created_at })),
    scores: r.scores.map((s) => ({ sessionId: s.session_id, instrument: s.instrument, total: s.total })),
    crisisTasks: r.tasks.map((t) => ({ createdAt: t.created_at, dueAt: t.due_at, acknowledgedAt: t.acknowledged_at })),
    adverse: r.adverse,
    stalledReferrals: r.stalled.map((s) => ({ sessionId: s.session_id })),
  });
  // Check-ins per organisation that people came from (counted with consent only).
  const orgCounts: Record<string, number> = {};
  for (const s of r.sessions) if (s.clinic_id && r.statsConsent(s.id)) orgCounts[s.clinic_id] = (orgCounts[s.clinic_id] ?? 0) + 1;
  return { ...outcomes, days: OUTCOME_DAYS, orgCounts };
}

/** The employer or university view: aggregates only, minimum group size 10. */
export async function loadOrgReport(orgId: string, now = new Date()) {
  const r = await loadRows(now);
  const referred = new Set(r.receipt.filter((e) => e.status === "referred").map((e) => e.session_id));
  const sessions: OrgSession[] = r.sessions
    .filter((s) => r.statsConsent(s.id))
    .map((s) => ({ orgId: s.clinic_id, path: s.path, createdAt: s.created_at, referred: referred.has(s.id) }));
  return { ...orgReport(sessions, orgId), days: OUTCOME_DAYS };
}
