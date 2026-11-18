import "server-only";
import { db } from "@/lib/db/server";
import { dueAt } from "@/lib/rules/tiers";
import { dueActions, FOLLOW_UP_CONFIG, stageStartedAt, type FollowUpAction, type Referral, type ReferralStatus } from "./followup";

// Referral follow-through: storage, the rules applied to it, and every change
// written to the audit trail. Callers check who may act (staff or the patient's cookie).

export type ReferralRow = {
  id: string;
  session_id: string;
  service_id: string;
  urgent: boolean;
  status: ReferralStatus;
  booked_for: string | null;
  referred_at: string;
  booked_at: string | null;
  first_contact_at: string | null;
  closed_at: string | null;
  reminder_at: string | null;
  help_requested_at: string | null;
  stalled_at: string | null;
  attendance_asked_at: string | null;
  urgent_requeued_at: string | null;
  last_patient_answer: string | null;
};

const COLUMNS =
  "id, session_id, service_id, urgent, status, booked_for, referred_at, booked_at, first_contact_at, closed_at, reminder_at, help_requested_at, stalled_at, attendance_asked_at, urgent_requeued_at, last_patient_answer";

export const toReferral = (r: ReferralRow): Referral => ({
  status: r.status,
  urgent: r.urgent,
  referredAt: r.referred_at,
  bookedFor: r.booked_for,
  bookedAt: r.booked_at,
  firstContactAt: r.first_contact_at,
  reminderAt: r.reminder_at,
  helpRequestedAt: r.help_requested_at,
  stalledAt: r.stalled_at,
  attendanceAskedAt: r.attendance_asked_at,
  urgentRequeuedAt: r.urgent_requeued_at,
});

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

async function audit(actor: string, action: string, row: { id: string; session_id: string }, metadata: object = {}) {
  must(
    await db().from("audit_events").insert({ actor, action, object_type: "referral", object_id: row.id, session_id: row.session_id, metadata }),
    "audit",
  );
}

async function receipt(sessionId: string, status: string, serviceId: string | null = null) {
  must(await db().from("receipt_events").insert({ session_id: sessionId, status, service_id: serviceId }), "receipt");
}

/** The latest referral for a case (one active hand-off at a time). */
export async function latestReferral(sessionId: string): Promise<ReferralRow | null> {
  const rows = must(
    await db().from("referrals").select(COLUMNS).eq("session_id", sessionId).order("referred_at", { ascending: false }).limit(1),
    "read referral",
  ) as ReferralRow[];
  return rows[0] ?? null;
}

/** "Hand-off stalled" / urgent check back in the queue, unless one is already open. */
async function requeue(row: ReferralRow, type: "handoff_stalled" | "handoff_check") {
  const open = must(
    await db().from("tasks").select("id").eq("session_id", row.session_id).eq("type", type).is("closed_at", null).limit(1),
    "read hand-off task",
  ) as { id: string }[];
  if (open.length) return;
  const now = new Date();
  const priority = row.urgent ? "urgent" : "elevated";
  must(
    await db().from("tasks").insert({ session_id: row.session_id, type, priority, due_at: dueAt(priority, now).toISOString() }),
    "hand-off task",
  );
}

// --- Clinician ---------------------------------------------------------------

export async function createReferral(actor: string, sessionId: string, serviceId: string, urgent: boolean) {
  // A new referral replaces any earlier open one.
  must(
    await db().from("referrals").update({ status: "closed", closed_at: new Date().toISOString() }).eq("session_id", sessionId).neq("status", "closed"),
    "close earlier referral",
  );
  const row = must(
    await db().from("referrals").insert({ session_id: sessionId, service_id: serviceId, urgent }).select(COLUMNS).single(),
    "create referral",
  ) as ReferralRow;
  await receipt(sessionId, "referred", serviceId);
  await audit(actor, "referral_created", row, { service: serviceId, urgent });
  return row;
}

export async function setBooked(actor: string, row: ReferralRow, bookedFor: string) {
  must(
    await db().from("referrals").update({ status: "booked", booked_for: bookedFor, booked_at: new Date().toISOString() }).eq("id", row.id),
    "booked",
  );
  await receipt(row.session_id, "booked");
  await audit(actor, "referral_booked", row, { booked_for: bookedFor });
}

export async function setFirstContact(actor: string, row: ReferralRow) {
  must(await db().from("referrals").update({ status: "first_contact", first_contact_at: new Date().toISOString() }).eq("id", row.id), "first contact");
  await receipt(row.session_id, "first_contact_confirmed");
  await audit(actor, "referral_first_contact", row);
}

/** Closes the hand-off and any hand-off tasks still open for the case. */
export async function closeReferral(actor: string, row: ReferralRow) {
  const now = new Date().toISOString();
  must(await db().from("referrals").update({ status: "closed", closed_at: now }).eq("id", row.id), "close referral");
  must(
    await db()
      .from("tasks")
      .update({ acknowledged_at: now, closed_at: now })
      .eq("session_id", row.session_id)
      .in("type", ["handoff_stalled", "handoff_check"])
      .is("closed_at", null),
    "close hand-off tasks",
  );
  await receipt(row.session_id, "closed");
  await audit(actor, "referral_closed", row);
}

// --- Patient (from the "Your next step" card) ---------------------------------

export async function patientAnswer(row: ReferralRow, answer: "booked" | "not_yet" | "help" | "attended" | "not_attended", bookedFor?: string) {
  if (answer === "booked" && bookedFor) return setBooked("patient", row, bookedFor);
  if (answer === "attended") return setFirstContact("patient", row);
  must(await db().from("referrals").update({ last_patient_answer: answer }).eq("id", row.id), "answer");
  if (answer === "not_yet") return audit("patient", "referral_not_booked_yet", row);
  // "I need help booking", or "I didn't see them": back to the queue straight away.
  const now = new Date().toISOString();
  if (answer === "help") must(await db().from("referrals").update({ help_requested_at: now, stalled_at: row.stalled_at ?? now }).eq("id", row.id), "help");
  else must(await db().from("referrals").update({ stalled_at: now }).eq("id", row.id), "not attended");
  await requeue(row, "handoff_stalled");
  await audit("patient", answer === "help" ? "referral_help_requested" : "referral_not_attended", row);
}

// --- The rules, applied ----------------------------------------------------------

/**
 * Applies every due follow-up rule to open referrals (or one case's). Runs on
 * each queue refresh and each time the patient's timeline loads, so no cron is
 * needed. Idempotent: each action writes its *_at column once, guarded in the
 * update itself so two runs at the same moment can't both act.
 */
export async function applyFollowUps(sessionId?: string, now = new Date()): Promise<number> {
  let q = db().from("referrals").select(COLUMNS).neq("status", "closed").limit(500);
  if (sessionId) q = q.eq("session_id", sessionId);
  const rows = must(await q, "open referrals") as ReferralRow[];
  let applied = 0;
  for (const row of rows) {
    for (const action of dueActions(toReferral(row), now, FOLLOW_UP_CONFIG)) {
      if (await apply(row, action, now)) applied += 1;
    }
  }
  return applied;
}

const COLUMN: Record<FollowUpAction, keyof ReferralRow> = {
  remind: "reminder_at",
  stall: "stalled_at",
  ask_attendance: "attendance_asked_at",
  urgent_requeue: "urgent_requeued_at",
};

async function apply(row: ReferralRow, action: FollowUpAction, now: Date): Promise<boolean> {
  const col = COLUMN[action];
  let q = db().from("referrals").update({ [col]: now.toISOString() }).eq("id", row.id);
  // Guard: only the run that changes the column acts (urgent requeue may repeat once per stage).
  q = action === "urgent_requeue" && row.urgent_requeued_at ? q.eq(col, row.urgent_requeued_at) : q.is(col, null);
  const changed = must(await q.select("id"), `rule ${action}`) as { id: string }[];
  if (changed.length === 0) return false;
  if (action === "stall") await requeue(row, "handoff_stalled");
  if (action === "urgent_requeue") await requeue(row, "handoff_check");
  await audit("system", `referral_${action}`, row, { rule: action, config: FOLLOW_UP_CONFIG, stage_started: stageStartedAt(toReferral(row)) });
  return true;
}
