import "server-only";
import { db } from "@/lib/db/server";
import { dueAt } from "@/lib/rules/tiers";
import { contactOverdue, ESCALATION, supervisorTriggers, type ContactLite } from "./safety-rules";

// Applies the console's safety rules on every queue refresh (no cron needed):
// the second escalation clock and the supervisor triggers. Idempotent.

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

async function audit(action: string, sessionId: string, objectId: string, metadata: object) {
  must(
    await db().from("audit_events").insert({ actor: "system", action, object_type: "task", object_id: objectId, session_id: sessionId, metadata }),
    "audit",
  );
}

/**
 * A task for the duty supervisor, already in the Escalated view. One per case
 * per trigger key, so repeated runs never duplicate it.
 */
export async function raiseSupervisorReview(sessionId: string, key: string, reason: string, actor = "system", requestedBy: string | null = null) {
  const existing = must(
    await db().from("tasks").select("id").eq("session_id", sessionId).eq("type", "supervisor_review").like("reason", `${key}:%`).limit(1),
    "read supervisor tasks",
  ) as { id: string }[];
  if (existing.length) return false;
  const now = new Date();
  const created = must(
    await db()
      .from("tasks")
      .insert({ session_id: sessionId, type: "supervisor_review", priority: "urgent", due_at: dueAt("urgent", now).toISOString(), escalated_at: now.toISOString(), reason: `${key}: ${reason}`, requested_by: requestedBy })
      .select("id")
      .single(),
    "supervisor task",
  ) as { id: string };
  must(
    await db().from("audit_events").insert({ actor, action: "supervisor_review_raised", object_type: "task", object_id: created.id, session_id: sessionId, metadata: { key, reason, safety_event: true } }),
    "audit",
  );
  return true;
}

export async function applyConsoleRules(now = new Date()): Promise<void> {
  await escalateUncontacted(now);
  await checkSupervisorTriggers(now);
}

/** Second clock: an acknowledged imminent (30 min) or urgent (reply-by time) task with no contact logged is escalated. */
async function escalateUncontacted(now: Date) {
  const tasks = must(
    await db()
      .from("tasks")
      .select("id, session_id, priority, created_at, due_at, acknowledged_at, escalated_at, closed_at")
      .in("priority", ["imminent", "urgent"])
      .not("acknowledged_at", "is", null)
      .is("escalated_at", null)
      .is("closed_at", null)
      .limit(500),
    "acknowledged imminent tasks",
  ) as { id: string; session_id: string; priority: string; created_at: string; due_at: string; acknowledged_at: string; escalated_at: null; closed_at: null }[];
  if (!tasks.length) return;
  const contacts = await contactsFor(tasks.map((t) => t.session_id));
  for (const t of tasks) {
    const task = { priority: t.priority, createdAt: t.created_at, dueAt: t.due_at, acknowledgedAt: t.acknowledged_at, escalatedAt: null, closedAt: null };
    if (!contactOverdue(task, contacts.get(t.session_id) ?? [], now)) continue;
    const changed = must(
      await db().from("tasks").update({ escalated_at: now.toISOString() }).eq("id", t.id).is("escalated_at", null).select("id"),
      "escalate uncontacted",
    ) as { id: string }[];
    if (changed.length) {
      await audit("contact_overdue_escalated", t.session_id, t.id, { priority: t.priority, safety_event: true });
    }
  }
}

async function contactsFor(sessionIds: string[]): Promise<Map<string, ContactLite[]>> {
  const rows = must(
    await db().from("contact_attempts").select("session_id, outcome, created_at").in("session_id", sessionIds),
    "contacts",
  ) as { session_id: string; outcome: ContactLite["outcome"]; created_at: string }[];
  const out = new Map<string, ContactLite[]>();
  for (const r of rows) out.set(r.session_id, [...(out.get(r.session_id) ?? []), { outcome: r.outcome, createdAt: r.created_at }]);
  return out;
}

/** Repeat crisis (across a person's check-ins) and imminent-but-unreachable cases go to the supervisor. */
async function checkSupervisorTriggers(now: Date) {
  const since = new Date(now.getTime() - ESCALATION.repeatCrisisWindowDays * 86_400_000).toISOString();
  const alerts = must(
    await db()
      .from("tasks")
      .select("session_id, priority, created_at, closed_at, sessions(parent_session_id)")
      .eq("type", "red_flag")
      .in("priority", ["urgent", "imminent"])
      .gte("created_at", since)
      .limit(2000),
    "crisis alerts",
  ) as unknown as { session_id: string; priority: string; created_at: string; closed_at: string | null; sessions: { parent_session_id: string | null } | null }[];
  if (!alerts.length) return;

  // One person = a check-in and its follow-ups (they share the first check-in as root).
  const rootOf = (a: (typeof alerts)[number]) => a.sessions?.parent_session_id ?? a.session_id;
  const byRoot = new Map<string, typeof alerts>();
  for (const a of alerts) byRoot.set(rootOf(a), [...(byRoot.get(rootOf(a)) ?? []), a]);
  const contacts = await contactsFor([...new Set(alerts.map((a) => a.session_id))]);

  for (const group of byRoot.values()) {
    const latest = [...group].sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
    const openImminent = group.find((a) => a.priority === "imminent" && !a.closed_at);
    const triggers = supervisorTriggers(
      {
        crisisAlerts: group.map((a) => ({ priority: a.priority, createdAt: a.created_at })),
        hasImminent: Boolean(openImminent),
        contacts: openImminent ? (contacts.get(openImminent.session_id) ?? []) : [],
      },
      now,
    );
    for (const t of triggers) {
      const sessionId = t.key === "imminent_unreachable" && openImminent ? openImminent.session_id : latest.session_id;
      await raiseSupervisorReview(sessionId, t.key, t.reason);
    }
  }
}
