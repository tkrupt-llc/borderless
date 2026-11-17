import "server-only";
import { db } from "@/lib/db/server";
import { buildSummary, type SummaryLine } from "@/lib/summary/build";

// Reads for the clinician console. Callers must have passed requireStaff().

function rows<T>(result: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return (result.data ?? []) as T[];
}

const PRIORITY_ORDER = ["imminent", "urgent", "elevated", "normal"];

export type QueueTask = {
  id: string;
  sessionId: string;
  type: string;
  priority: string;
  dueAt: string;
  createdAt: string;
  acknowledgedAt: string | null;
  escalatedAt: string | null;
  ruleId: string | null;
  path: string;
  hasPhone: boolean;
  clinicId: string | null;
};

/** Open tasks, most urgent first, then by time left. */
export async function loadQueue(): Promise<QueueTask[]> {
  type Row = {
    id: string; session_id: string; type: string; priority: string; due_at: string; created_at: string;
    acknowledged_at: string | null; escalated_at: string | null;
    red_flag_events: { rule_id: string } | null;
    sessions: { path: string; contact_phone: string | null; clinic_id: string | null } | null;
  };
  const data = rows<Row>(
    await db()
      .from("tasks")
      .select(
        "id, session_id, type, priority, due_at, created_at, acknowledged_at, escalated_at, red_flag_events(rule_id), sessions(path, contact_phone, clinic_id)",
      )
      .is("closed_at", null),
    "load queue",
  );
  return data
    .map((t) => ({
      id: t.id,
      sessionId: t.session_id,
      type: t.type,
      priority: t.priority,
      dueAt: t.due_at,
      createdAt: t.created_at,
      acknowledgedAt: t.acknowledged_at,
      escalatedAt: t.escalated_at,
      ruleId: t.red_flag_events?.rule_id ?? null,
      path: t.sessions?.path ?? "",
      hasPhone: Boolean(t.sessions?.contact_phone),
      clinicId: t.sessions?.clinic_id ?? null,
    }))
    .sort(
      (a, b) =>
        PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) || a.dueAt.localeCompare(b.dueAt),
    );
}

export type CaseData = Awaited<ReturnType<typeof loadCase>>;

export async function loadCase(sessionId: string) {
  const one = async <T>(table: string, cols: string, order = "created_at") =>
    rows<T>(await db().from(table).select(cols).eq("session_id", sessionId).order(order, { ascending: true }), table);

  // One parallel batch: every query for the case goes out at once.
  const [sessionRows, consents, scores, answers, redFlags, messages, fields, proposals, tasks, receipt, contacts, summaryRows, activityRows] =
    await Promise.all([
      db().from("sessions").select("*").eq("id", sessionId).then((r) =>
        rows<{
          id: string; path: string; created_at: string; taken_over: boolean; discreet_mode: boolean;
          contact_phone: string | null; preferred_language: string | null; preferred_clinician_gender: string | null;
          callback_time: string | null; history_bpd: boolean; history_adhd: boolean; history_source: string | null;
          clinic_id: string | null;
        }>(r, "session"),
      ),
      one<{ purpose: string; granted: boolean }>("consent_records", "purpose, granted, created_at"),
      one<{ instrument: string; total: number; band: string }>("scores", "instrument, total, band, created_at"),
      one<{ item_id: string; value: number }>("item_responses", "item_id, value, created_at"),
      one<{ rule_id: string; tier: string; trigger: string; created_at: string; message_id: string | null }>(
        "red_flag_events", "rule_id, tier, trigger, created_at, message_id"),
      one<{ id: string; role: string; text: string }>("messages", "id, role, text, created_at"),
      one<{ field: string; value: string; source_message_id: string }>("extracted_fields", "field, value, source_message_id, created_at"),
      // Decisions come embedded in their proposal, so no second trip is needed.
      one<{
        id: string; step: number | null; urgent: boolean; rule_ids: string[]; reasons: string[]; created_at: string;
        clinician_decisions: { action: string; new_step: number | null; reason: string | null; created_at: string }[];
      }>("triage_proposals", "id, step, urgent, rule_ids, reasons, created_at, clinician_decisions(action, new_step, reason, created_at)"),
      one<{ id: string; type: string; priority: string; due_at: string; acknowledged_at: string | null; escalated_at: string | null; closed_at: string | null }>(
        "tasks", "id, type, priority, due_at, acknowledged_at, escalated_at, closed_at, created_at"),
      one<{ status: string; reason: string | null; service_id: string | null; created_at: string }>("receipt_events", "status, reason, service_id, created_at"),
      one<{ outcome: string; note: string | null; created_at: string }>("contact_attempts", "outcome, note, created_at"),
      one<{ draft: { lines: SummaryLine[] }; edited: { text: string } | null; review_started_at: string | null; signed_at: string | null }>(
        "summaries", "draft, edited, review_started_at, signed_at", "updated_at"),
      // The audit trail for this case, newest first (research: keep the audit trail visible).
      db().from("audit_events").select("actor, action, created_at").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(40)
        .then((r) => rows<{ actor: string; action: string; created_at: string }>(r, "activity")),
    ]);
  const session = sessionRows[0];
  if (!session) return null;

  // The proposal the clinician decides on: an urgent one wins, else the latest.
  const proposal = proposals.find((p) => p.urgent) ?? proposals.at(-1) ?? null;
  const decisions = [...(proposal?.clinician_decisions ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const activity = activityRows;

  const messageText = new Map(messages.map((m) => [m.id, m.text]));
  const latestConsent = Object.fromEntries(consents.map((c) => [c.purpose, c.granted]));
  const draftLines = buildSummary({
    fields: fields.map((f) => ({ field: f.field, value: f.value, quote: messageText.get(f.source_message_id) ?? null })),
    scores,
    redFlags: redFlags.map((r) => ({ ruleId: r.rule_id, tier: r.tier, trigger: r.trigger })),
    preferences: { language: session.preferred_language, clinicianGender: session.preferred_clinician_gender },
    history: { bpd: session.history_bpd, adhd: session.history_adhd },
    proposal: proposal ? { step: proposal.step, urgent: proposal.urgent, reasons: proposal.reasons } : null,
  });

  return {
    session,
    consents: latestConsent,
    scores,
    answers,
    redFlags: redFlags.map((r) => ({ ...r, quote: r.message_id ? (messageText.get(r.message_id) ?? null) : null })),
    messages,
    proposal,
    decision: decisions.at(-1) ?? null,
    tasks,
    receipt,
    contacts,
    summary: summaryRows[0] ?? null,
    draftLines,
    activity,
  };
}

/**
 * Finds a case from its reference (BL- plus the first 6 hex characters of the
 * session id), using a range on the id. Returns the ids that match.
 */
export async function findCase(ref: string): Promise<string[]> {
  const hex = /^(?:BL-?)?([0-9a-f]{6})$/i.exec(ref.trim())?.[1]?.toLowerCase();
  if (!hex) return [];
  const result = await db()
    .from("sessions")
    .select("id")
    .gte("id", `${hex}00-0000-0000-0000-000000000000`)
    .lte("id", `${hex}ff-ffff-ffff-ffff-ffffffffffff`)
    .limit(5);
  return rows<{ id: string }>(result, "find case").map((r) => r.id);
}

/** The person's chain of check-ins (first one plus follow-ups) with every score, oldest first. */
export async function loadCaseTrend(sessionId: string) {
  const self = rows<{ id: string; parent_session_id: string | null }>(
    await db().from("sessions").select("id, parent_session_id").eq("id", sessionId),
    "session chain",
  )[0];
  if (!self) return null;
  const rootId = self.parent_session_id ?? self.id;
  const sessions = rows<{ id: string; path: string; created_at: string }>(
    await db().from("sessions").select("id, path, created_at").or(`id.eq.${rootId},parent_session_id.eq.${rootId}`).order("created_at"),
    "chain sessions",
  );
  if (sessions.length < 2) return { rootId, sessions, points: [] };
  const points = rows<{ session_id: string; instrument: string; total: number; band: string; created_at: string }>(
    await db().from("scores").select("session_id, instrument, total, band, created_at").in("session_id", sessions.map((s) => s.id)).order("created_at"),
    "chain scores",
  ).map((r) => ({ sessionId: r.session_id, at: r.created_at, instrument: r.instrument, total: r.total, band: r.band }));
  return { rootId, sessions, points };
}

/** Open, not yet acknowledged imminent tasks: what the console alert watches. */
export async function loadImminentAlerts(): Promise<{ id: string; sessionId: string; createdAt: string }[]> {
  return rows<{ id: string; session_id: string; created_at: string }>(
    await db()
      .from("tasks")
      .select("id, session_id, created_at")
      .eq("priority", "imminent")
      .is("closed_at", null)
      .is("acknowledged_at", null)
      .order("created_at"),
    "imminent alerts",
  ).map((t) => ({ id: t.id, sessionId: t.session_id, createdAt: t.created_at }));
}

/** Latest score per questionnaire for each case in the queue, e.g. "PHQ-9 19 · GAD-7 12". */
export async function loadQueueScores(sessionIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (sessionIds.length === 0) return out;
  const data = rows<{ session_id: string; instrument: string; total: number; created_at: string }>(
    await db().from("scores").select("session_id, instrument, total, created_at").in("session_id", sessionIds).order("created_at"),
    "queue scores",
  );
  const LABEL: Record<string, string> = { PHQ9: "PHQ-9", GAD7: "GAD-7", PHQ2: "PHQ-2", GAD2: "GAD-2", ASQ: "ASQ" };
  const latest = new Map<string, Map<string, number>>();
  for (const r of data) {
    const m = latest.get(r.session_id) ?? new Map<string, number>();
    m.set(r.instrument, r.total);
    latest.set(r.session_id, m);
  }
  for (const [id, m] of latest) {
    // Full questionnaires when present, otherwise the two-item screens.
    const pick = m.has("PHQ9") || m.has("GAD7") ? ["PHQ9", "GAD7"] : ["PHQ2", "GAD2", "ASQ"];
    out.set(id, pick.filter((i) => m.has(i)).map((i) => `${LABEL[i]} ${m.get(i)}`).join(" · "));
  }
  return out;
}
