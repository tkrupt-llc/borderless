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
};

/** Open tasks, most urgent first, then by time left. */
export async function loadQueue(): Promise<QueueTask[]> {
  type Row = {
    id: string; session_id: string; type: string; priority: string; due_at: string; created_at: string;
    acknowledged_at: string | null; escalated_at: string | null;
    red_flag_events: { rule_id: string } | null;
    sessions: { path: string; contact_phone: string | null } | null;
  };
  const data = rows<Row>(
    await db()
      .from("tasks")
      .select(
        "id, session_id, type, priority, due_at, created_at, acknowledged_at, escalated_at, red_flag_events(rule_id), sessions(path, contact_phone)",
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

  const sessionRows = rows<{
    id: string; path: string; created_at: string; taken_over: boolean; discreet_mode: boolean;
    contact_phone: string | null; preferred_language: string | null; preferred_clinician_gender: string | null;
    callback_time: string | null; history_bpd: boolean; history_adhd: boolean; history_source: string | null;
  }>(await db().from("sessions").select("*").eq("id", sessionId), "session");
  const session = sessionRows[0];
  if (!session) return null;

  const [consents, scores, answers, redFlags, messages, fields, proposals, tasks, receipt, contacts, summaryRows] =
    await Promise.all([
      one<{ purpose: string; granted: boolean }>("consent_records", "purpose, granted, created_at"),
      one<{ instrument: string; total: number; band: string }>("scores", "instrument, total, band, created_at"),
      one<{ item_id: string; value: number }>("item_responses", "item_id, value, created_at"),
      one<{ rule_id: string; tier: string; trigger: string; created_at: string; message_id: string | null }>(
        "red_flag_events", "rule_id, tier, trigger, created_at, message_id"),
      one<{ id: string; role: string; text: string }>("messages", "id, role, text, created_at"),
      one<{ field: string; value: string; source_message_id: string }>("extracted_fields", "field, value, source_message_id, created_at"),
      one<{ id: string; step: number | null; urgent: boolean; rule_ids: string[]; reasons: string[]; created_at: string }>(
        "triage_proposals", "id, step, urgent, rule_ids, reasons, created_at"),
      one<{ id: string; type: string; priority: string; due_at: string; acknowledged_at: string | null; escalated_at: string | null; closed_at: string | null }>(
        "tasks", "id, type, priority, due_at, acknowledged_at, escalated_at, closed_at, created_at"),
      one<{ status: string; reason: string | null; created_at: string }>("receipt_events", "status, reason, created_at"),
      one<{ outcome: string; note: string | null; created_at: string }>("contact_attempts", "outcome, note, created_at"),
      one<{ draft: { lines: SummaryLine[] }; edited: { text: string } | null; review_started_at: string | null; signed_at: string | null }>(
        "summaries", "draft, edited, review_started_at, signed_at", "updated_at"),
    ]);

  // The proposal the clinician decides on: an urgent one wins, else the latest.
  const proposal = proposals.find((p) => p.urgent) ?? proposals.at(-1) ?? null;
  const decisions = proposal
    ? rows<{ action: string; new_step: number | null; reason: string | null; created_at: string }>(
        await db().from("clinician_decisions").select("action, new_step, reason, created_at").eq("proposal_id", proposal.id).order("created_at"),
        "decisions",
      )
    : [];

  // The audit trail for this case, newest first (research: keep the audit trail visible).
  const activity = rows<{ actor: string; action: string; created_at: string }>(
    await db().from("audit_events").select("actor, action, created_at").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(40),
    "activity",
  );

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
