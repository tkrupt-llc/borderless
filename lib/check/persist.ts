import "server-only";
import { db } from "@/lib/db/server";
import { bankItem } from "@/lib/item-bank";
import type { RuleFile } from "@/lib/contracts/rules";
import type { Score } from "@/lib/rules/scoring";
import { dueAt, nextWorkingDay } from "@/lib/rules/tiers";
import consent from "@/content/consent.json";

/**
 * Database writes for the patient flow. Server only, service-role client.
 * Every function throws on a database error so the caller can refuse to move
 * on, rather than silently losing an answer or a red flag.
 */

type Path = "quick" | "full" | "crisis";
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
export async function finishCheckIn(sessionId: string, scores: Score[], clinicianReview: boolean) {
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

export async function saveContact(sessionId: string, phone: string, callbackTime: string | null) {
  check(
    await db().from("sessions").update({ contact_phone: phone, callback_time: callbackTime }).eq("id", sessionId),
    "save contact",
  );
  await audit("contact_shared", sessionId, "session");
}
