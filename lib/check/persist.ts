import "server-only";
import { db } from "@/lib/db/server";
import { bankItem } from "@/lib/item-bank";
import type { RuleFile } from "@/lib/contracts/rules";
import type { Score } from "@/lib/rules/scoring";
import type { Proposal } from "@/lib/rules/routing";
import { dueAt, nextWorkingDay } from "@/lib/rules/tiers";
import consent from "@/content/consent.json";
import { newFollowUpToken } from "@/lib/followup/trend";

/**
 * Database writes for the patient flow. Server only, service-role client.
 * Every function throws on a database error so the caller can refuse to move
 * on, rather than silently losing an answer or a red flag.
 */

type Path = "quick" | "full" | "crisis" | "contact" | "followup";
export type ConsentChoices = Record<string, boolean>;

function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

async function audit(action: string, sessionId: string, objectType: string, metadata: object = {}) {
  check(
    await db().from("audit_events").insert({
      actor: "patient",
      action,
      object_type: objectType,
      object_id: sessionId,
      session_id: sessionId,
      metadata,
    }),
    "audit",
  );
}

export async function createSession(path: Path, discreetMode: boolean, choices: ConsentChoices): Promise<string> {
  const session = check(
    await db().from("sessions").insert({ path, discreet_mode: discreetMode }).select("id").single(),
    "create session",
  ) as { id: string };

  // One row per purpose asked on this screen, with the version shown. Purposes
  // asked later (on the result page) are recorded when the person answers them.
  await addConsents(session.id, "start", choices);
  return session.id;
}

/** Appends one row per purpose asked at `askOn`: the consent log is append-only, newest row wins. */
export async function addConsents(sessionId: string, askOn: "start" | "result", choices: ConsentChoices) {
  const rows = consent.purposes
    .filter((p) => p.askOn === askOn)
    .map((p) => ({ session_id: sessionId, purpose: p.id, granted: choices[p.id] === true, version: consent.version }));
  if (rows.length === 0) return;
  check(await db().from("consent_records").insert(rows), "consent records");
  await audit("consent_recorded", sessionId, "session", { version: consent.version, askOn, choices });
}

export async function getSession(id: string) {
  return check(
    await db().from("sessions").select("id, path, taken_over, history_bpd, history_adhd").eq("id", id).maybeSingle(),
    "read session",
  ) as { id: string; path: Path; taken_over: boolean; history_bpd: boolean; history_adhd: boolean } | null;
}

/** Latest choice per purpose (the log is append-only, so newest row wins). */
export async function getConsents(sessionId: string): Promise<ConsentChoices> {
  const rows = check(
    await db()
      .from("consent_records")
      .select("purpose, granted, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    "read consents",
  ) as { purpose: string; granted: boolean }[];
  return Object.fromEntries(rows.map((r) => [r.purpose, r.granted]));
}

/** Upsert: changing an answer on the way back replaces it. */
export async function saveAnswers(sessionId: string, answers: Record<string, number>) {
  const rows = Object.entries(answers).map(([itemId, value]) => {
    const item = bankItem(itemId);
    if (!item) throw new Error(`unknown item ${itemId}`);
    return { session_id: sessionId, instrument: item.instrument, item_no: item.number, item_id: itemId, value };
  });
  if (rows.length === 0) return;
  check(
    await db().from("item_responses").upsert(rows, { onConflict: "session_id,check_in_id,instrument,item_no" }),
    "save answers",
  );
}

/**
 * Raises each newly fired rule once per session through the raise_red_flag rpc,
 * which writes the takeover, event, task and audit entry atomically.
 */
export async function raiseRedFlags(
  sessionId: string,
  fired: RuleFile["rules"],
  trigger: string,
  messageId: string | null = null,
) {
  if (fired.length === 0) return;
  const existing = check(
    await db().from("red_flag_events").select("rule_id").eq("session_id", sessionId),
    "read red flags",
  ) as { rule_id: string }[];
  const already = new Set(existing.map((e) => e.rule_id));

  // The first red flag also records the "urgent" proposal the clinician will see.
  const takeover = fired.filter((r) => r.then.some((a) => a.action === "takeover_session"));
  if (already.size === 0 && takeover.length > 0) {
    check(
      await db().from("triage_proposals").insert({
        session_id: sessionId,
        step: null,
        urgent: true,
        rule_ids: takeover.map((r) => r.id),
        reasons: takeover.map((r) => r.description),
        ruleset_version: "red_flags",
      }),
      "save urgent proposal",
    );
  }

  for (const rule of fired) {
    if (already.has(rule.id)) continue;
    const task = rule.then.find((a) => a.action === "create_task");
    const tier = task && task.action === "create_task" ? task.tier : "urgent";
    check(
      await db().rpc("raise_red_flag", {
        p_session_id: sessionId,
        p_trigger: trigger,
        p_rule_id: rule.id,
        p_tier: tier,
        p_due_at: dueAt(tier, new Date()).toISOString(),
        p_message_id: messageId,
      }),
      `raise ${rule.id}`,
    );
  }
}

/**
 * End of a check-in: store the scores, the receipt's first status and, with
 * clinician-review consent, a review task due in one working day.
 */
/** True if the AI chat recorded this history field for the session. */
export async function hasExtractedField(sessionId: string, field: string): Promise<boolean> {
  const rows = check(
    await db().from("extracted_fields").select("id").eq("session_id", sessionId).eq("field", field).limit(1),
    "read extracted fields",
  ) as unknown[];
  return rows.length > 0;
}

export async function finishCheckIn(
  sessionId: string,
  scores: Score[],
  clinicianReview: boolean,
  proposal: Proposal | null = null,
) {
  if (scores.length > 0) {
    check(
      await db()
        .from("scores")
        .insert(
          scores.map((s) => ({
            session_id: sessionId,
            instrument: s.instrument,
            total: s.total,
            band: s.band,
            computed_by_rule: "lib/rules/scoring.ts",
          })),
        ),
      "save scores",
    );
  }
  if (!clinicianReview) {
    await audit("check_in_completed", sessionId, "session", { sent_to_clinician: false });
    return;
  }
  if (proposal && proposal.step !== null) {
    check(
      await db().from("triage_proposals").insert({
        session_id: sessionId,
        step: proposal.step,
        urgent: false,
        rule_ids: proposal.ruleIds,
        reasons: proposal.reasons,
        ruleset_version: proposal.rulesetVersion,
      }),
      "save proposal",
    );
  }
  check(await db().from("receipt_events").insert({ session_id: sessionId, status: "received" }), "receipt");
  check(
    await db().from("tasks").insert({
      session_id: sessionId,
      type: "care_request",
      priority: "normal",
      due_at: nextWorkingDay(new Date()).toISOString(),
    }),
    "review task",
  );
  await audit("check_in_completed", sessionId, "session", { sent_to_clinician: true });
}

/** Everything the patient's receipt timeline needs, for their own session. */
export async function loadReceiptData(sessionId: string) {
  const events = check(
    await db().from("receipt_events").select("status, reason, created_at").eq("session_id", sessionId).order("created_at"),
    "receipt events",
  ) as { status: string; reason: string | null; created_at: string }[];
  const proposals = check(
    await db().from("triage_proposals").select("id, step, urgent, created_at").eq("session_id", sessionId).order("created_at"),
    "proposals",
  ) as { id: string; step: number | null; urgent: boolean }[];
  const proposal = proposals.find((p) => p.urgent) ?? proposals.at(-1) ?? null;
  const decisions = proposal
    ? (check(
        await db().from("clinician_decisions").select("action, new_step, created_at").eq("proposal_id", proposal.id).order("created_at"),
        "decisions",
      ) as { action: string; new_step: number | null }[])
    : [];
  const decision = decisions.at(-1);
  return {
    events: events.map((e) => ({ status: e.status, reason: e.reason, createdAt: e.created_at })),
    proposal: proposal ? { step: proposal.step, urgent: proposal.urgent } : null,
    decision: decision ? { action: decision.action, newStep: decision.new_step } : null,
    followUp: (await getConsents(sessionId)).follow_up === true,
  };
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export type StoredMessage = { id: string; role: "patient" | "assistant" | "system"; text: string };

export async function loadTranscript(sessionId: string): Promise<StoredMessage[]> {
  return check(
    await db()
      .from("messages")
      .select("id, role, text")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    "load messages",
  ) as StoredMessage[];
}

export async function saveMessage(sessionId: string, role: StoredMessage["role"], text: string): Promise<string> {
  const row = check(
    await db().from("messages").insert({ session_id: sessionId, role, text }).select("id").single(),
    "save message",
  ) as { id: string };
  return row.id;
}

/** Every field cites the patient message it came from (enforced again by a NOT NULL foreign key). */
export async function saveExtracted(sessionId: string, fields: { field: string; value: string; sourceMessageId: string }[]) {
  if (fields.length === 0) return;
  check(
    await db()
      .from("extracted_fields")
      .insert(fields.map((f) => ({ session_id: sessionId, field: f.field, value: f.value, source_message_id: f.sourceMessageId }))),
    "save extracted fields",
  );
}

/** Self-reported BPD/ADHD history switches on the extra safeguards. It can only be added, never removed here. */
export async function markSelfReportedHistory(sessionId: string, history: { bpd: boolean; adhd: boolean }) {
  if (!history.bpd && !history.adhd) return;
  const update: Record<string, unknown> = { history_source: "self_reported" };
  if (history.bpd) update.history_bpd = true;
  if (history.adhd) update.history_adhd = true;
  check(await db().from("sessions").update(update).eq("id", sessionId), "save history");
  await audit("history_self_reported", sessionId, "session", history);
}

export async function logEvent(sessionId: string, action: string, metadata: object) {
  await audit(action, sessionId, "session", metadata);
}

export async function saveContact(
  sessionId: string,
  phone: string,
  callbackTime: string | null,
  preferences: { language?: string | null; clinicianGender?: string | null } = {},
) {
  const update: Record<string, unknown> = { contact_phone: phone, callback_time: callbackTime };
  if (preferences.language !== undefined) update.preferred_language = preferences.language;
  if (preferences.clinicianGender !== undefined) update.preferred_clinician_gender = preferences.clinicianGender;
  check(await db().from("sessions").update(update).eq("id", sessionId), "save contact");
  await audit("contact_shared", sessionId, "session");
}

/**
 * "Talk to a person": a non-urgent call-back task due in one working day.
 * One open request per session; asking again only updates the contact details.
 */
export async function requestCallback(sessionId: string): Promise<Date> {
  const open = check(
    await db().from("tasks").select("due_at").eq("session_id", sessionId).eq("type", "talk_to_person").is("closed_at", null).limit(1),
    "read call-back task",
  ) as { due_at: string }[];
  if (open[0]) return new Date(open[0].due_at);
  const due = nextWorkingDay(new Date());
  check(
    await db().from("tasks").insert({ session_id: sessionId, type: "talk_to_person", priority: "normal", due_at: due.toISOString() }),
    "call-back task",
  );
  await audit("callback_requested", sessionId, "session");
  return due;
}

/**
 * "This isn't helping" on a coping card: one open not_helping task per session,
 * due within one working day (elevated). Only for people who agreed to clinician review.
 */
export async function flagNotHelping(sessionId: string, cardId: string): Promise<void> {
  const open = check(
    await db().from("tasks").select("id").eq("session_id", sessionId).eq("type", "not_helping").is("closed_at", null).limit(1),
    "read not-helping task",
  ) as { id: string }[];
  if (open[0]) return;
  check(
    await db().from("tasks").insert({ session_id: sessionId, type: "not_helping", priority: "elevated", due_at: dueAt("elevated", new Date()).toISOString() }),
    "not-helping task",
  );
  await audit("coping_not_helping", sessionId, "session", { card: cardId });
}

/**
 * "Delete my data". Deleting the session removes everything linked to it
 * (answers, scores, chat, contact details, tasks, receipt) through the
 * database's cascades, and the audit lines for it. One safety exception: while
 * an urgent or imminent red flag is still open, the care team keeps the record
 * until they have been in touch; the request is logged so they can act on it.
 * (Draft policy, for the psychiatrist to approve.)
 */
export async function deleteSessionData(sessionId: string): Promise<"deleted" | "held"> {
  const openRisk = check(
    await db()
      .from("tasks")
      .select("id")
      .eq("session_id", sessionId)
      .eq("type", "red_flag")
      .in("priority", ["imminent", "urgent"])
      .is("closed_at", null)
      .limit(1),
    "read open red flags",
  ) as { id: string }[];
  if (openRisk[0]) {
    await audit("deletion_requested", sessionId, "session");
    return "held";
  }
  check(await db().from("audit_events").delete().eq("session_id", sessionId), "delete audit lines");
  check(await db().from("sessions").delete().eq("id", sessionId), "delete session");
  // A count-only record that a deletion happened, with nothing that links it to the person.
  check(
    await db().from("audit_events").insert({ actor: "patient", action: "data_deleted", object_type: "session", object_id: null, session_id: null }),
    "log deletion",
  );
  return "deleted";
}

// ---------------------------------------------------------------------------
// Follow-up check-ins
// ---------------------------------------------------------------------------

/** The first check-in of a chain (a follow-up points at it). */
async function rootOf(sessionId: string): Promise<string> {
  const row = check(
    await db().from("sessions").select("id, parent_session_id").eq("id", sessionId).maybeSingle(),
    "read session chain",
  ) as { id: string; parent_session_id: string | null } | null;
  if (!row) throw new Error("no session");
  return row.parent_session_id ?? row.id;
}

/** The private follow-up token for this person's chain, created on first use. */
export async function ensureFollowUpToken(sessionId: string): Promise<string> {
  const root = await rootOf(sessionId);
  const row = check(
    await db().from("sessions").select("follow_up_token").eq("id", root).single(),
    "read follow-up token",
  ) as { follow_up_token: string | null };
  if (row.follow_up_token) return row.follow_up_token;
  const token = newFollowUpToken();
  check(await db().from("sessions").update({ follow_up_token: token }).eq("id", root), "save follow-up token");
  await audit("follow_up_link_created", root, "session");
  return token;
}

export async function findFollowUpRoot(token: string): Promise<{ id: string; created_at: string } | null> {
  return check(
    await db().from("sessions").select("id, created_at").eq("follow_up_token", token).maybeSingle(),
    "find follow-up",
  ) as { id: string; created_at: string } | null;
}

/**
 * Starts a follow-up as its own session, linked to the first check-in. It
 * carries over what the person already told us (contact preferences, known
 * history) and their latest consent choices, so they are not asked again.
 */
export async function createFollowUpSession(rootId: string): Promise<string> {
  const root = check(
    await db()
      .from("sessions")
      .select("discreet_mode, contact_phone, preferred_language, preferred_clinician_gender, callback_time, history_bpd, history_adhd, history_source")
      .eq("id", rootId)
      .single(),
    "read first check-in",
  ) as Record<string, unknown>;
  const created = check(
    await db().from("sessions").insert({ ...root, path: "followup", parent_session_id: rootId }).select("id").single(),
    "create follow-up",
  ) as { id: string };
  const choices = await getConsents(rootId);
  const rows = Object.entries(choices).map(([purpose, granted]) => ({ session_id: created.id, purpose, granted, version: consent.version }));
  if (rows.length) check(await db().from("consent_records").insert(rows), "carry over consents");
  await audit("follow_up_started", created.id, "session", { parent: rootId });
  return created.id;
}

export type TrendPoint = { sessionId: string; at: string; instrument: string; total: number; band: string };

/** Every score in this person's chain (first check-in and follow-ups), oldest first. */
export async function loadTrend(sessionId: string): Promise<{ rootId: string; sessions: { id: string; path: string; created_at: string }[]; points: TrendPoint[] }> {
  const rootId = await rootOf(sessionId);
  const sessions = check(
    await db().from("sessions").select("id, path, created_at").or(`id.eq.${rootId},parent_session_id.eq.${rootId}`).order("created_at"),
    "read chain",
  ) as { id: string; path: string; created_at: string }[];
  const rows = check(
    await db().from("scores").select("session_id, instrument, total, band, created_at").in("session_id", sessions.map((s) => s.id)).order("created_at"),
    "read chain scores",
  ) as { session_id: string; instrument: string; total: number; band: string; created_at: string }[];
  return {
    rootId,
    sessions,
    points: rows.map((r) => ({ sessionId: r.session_id, at: r.created_at, instrument: r.instrument, total: r.total, band: r.band })),
  };
}

/** A "not on track" task for the care team: due within one working day. */
export async function raiseNotOnTrack(sessionId: string, reasons: string[]) {
  check(
    await db().from("tasks").insert({ session_id: sessionId, type: "not_on_track", priority: "elevated", due_at: dueAt("elevated", new Date()).toISOString() }),
    "not-on-track task",
  );
  await audit("not_on_track", sessionId, "session", { reasons });
}
