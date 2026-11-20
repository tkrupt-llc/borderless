"use server";

import { z } from "zod";
import { audit } from "@/lib/staff/audit";
import { raiseSupervisorReview } from "@/lib/staff/supervision";
import { canCloseCase, canCloseRedFlag, CLOSURE_REASONS, CLOSURE_STEPS, coSignAllowed, ESCALATION, needsCoSign, postCrisisCheckIns, type ClosureReason, type ClosureStep } from "@/lib/staff/safety-rules";
import { latestReferral as latestReferralRow } from "@/lib/referral/persist";
import { closureStateFrom } from "@/lib/staff/closure";
import * as persist from "@/lib/check/persist";
import { allowedChannels } from "@/lib/consent";
import { newCodeMessage } from "@/lib/contact/messages";
import { caseRef } from "@/lib/case-ref";
import * as referral from "@/lib/referral/persist";
import { refresh } from "next/cache";
import { db } from "@/lib/db/server";
import { canWrite, requireStaff, type Staff } from "@/lib/staff/auth";
import { loadCase, loadImminentAlerts } from "@/lib/staff/data";
import { scopeOf, sessionInScope, taskSessionInScope, type Scope } from "@/lib/staff/scope";
import { summaryToText } from "@/lib/summary/build";
import { serviceById } from "@/lib/directory";
import { dueAt, nextWorkingDay } from "@/lib/rules/tiers";

// Every action checks the signed-in role, writes with the service client and
// leaves an audit entry. Judges can view but not change anything.

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();

function must(result: { error: { message: string } | null }, what: string) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
}

/** An error whose message is shown to the clinician as-is (e.g. why a case can't close). */
class UserError extends Error {}

/**
 * Parses a case id and checks it is in this account's scope (the guest works on demo cases only,
 * everyone else on real ones). Out of scope is reported as not found.
 */
async function caseId(staff: Staff, sessionId: string): Promise<string> {
  const id = uuid.parse(sessionId);
  if (!(await sessionInScope(id, scopeOf(staff)))) throw new UserError("Case not found.");
  return id;
}

/** The same check for a task, through the case it belongs to. */
async function taskInScope(staff: Staff, id: string): Promise<string> {
  const parsed = uuid.parse(id);
  if (!(await taskSessionInScope(parsed, scopeOf(staff)))) throw new UserError("Task not found.");
  return parsed;
}

async function run(fn: (staff: Staff) => Promise<void>): Promise<Result> {
  const staff = await requireStaff();
  if (!canWrite(staff)) return { ok: false, error: "This account can view cases but not change them." };
  try {
    await fn(staff);
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "That didn't save. Please try again." };
  }
}

async function addReceipt(sessionId: string, status: string, reason: string | null = null) {
  must(await db().from("receipt_events").insert({ session_id: sessionId, status, reason }), "receipt");
}

export async function acknowledgeTask(taskId: string): Promise<Result> {
  return run(async (staff) => {
    const id = await taskInScope(staff, taskId);
    const { data, error } = await db()
      .from("tasks")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: staff.id })
      .eq("id", id)
      .is("acknowledged_at", null)
      .select("session_id");
    must({ error }, "acknowledge");
    if (data?.[0]) await audit(staff, "task_acknowledged", "task", id, data[0].session_id);
  });
}

/** Acknowledges every open, not yet acknowledged task on a case (one click from the queue). */
export async function acknowledgeCase(sessionId: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const { data, error } = await db()
      .from("tasks")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: staff.id })
      .eq("session_id", id)
      .is("acknowledged_at", null)
      .is("closed_at", null)
      .select("id");
    must({ error }, "acknowledge case");
    for (const t of data ?? []) await audit(staff, "task_acknowledged", "task", t.id, id);
  });
}

/** Hands a case to the duty supervisor now, without waiting for its clock to run out. */
export async function escalateCase(sessionId: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    must(
      await db().from("tasks").update({ escalated_at: new Date().toISOString() }).eq("session_id", id).is("closed_at", null).is("escalated_at", null),
      "escalate",
    );
    await audit(staff, "manual_escalation", "session", id, id);
  });
}

export async function closeTask(taskId: string, signOffReason?: string): Promise<Result> {
  return run(async (staff) => {
    const id = await taskInScope(staff, taskId);
    const { data: task } = await db().from("tasks").select("type, session_id, reason, requested_by").eq("id", id).single();
    // Supervisor reviews (co-sign, repeat crisis, unreachable, adverse event) are closed by a supervisor,
    // and a co-sign by someone other than the person who asked for it.
    if (task?.type === "supervisor_review") {
      if (staff.role !== "supervisor") throw new UserError("Only the duty supervisor can close a supervisor review.");
      if (task.requested_by && !coSignAllowed(staff.id, task.requested_by)) throw new UserError("The co-sign must come from a different person from the one who asked for it.");
    }
    // A red-flag task closes after a logged conversation, or with the supervisor's sign-off and a reason.
    if (task?.type === "red_flag") {
      const { data: spoke } = await db().from("contact_attempts").select("id").eq("session_id", task.session_id).eq("outcome", "spoke").limit(1);
      const check = canCloseRedFlag({ spokeLogged: (spoke ?? []).length > 0, isSupervisor: staff.role === "supervisor", reason: signOffReason });
      if (!check.ok) throw new UserError(check.error!);
      if (!(spoke ?? []).length) await audit(staff, "red_flag_signed_off", "task", id, task.session_id, { reason: signOffReason!.trim() });
    }
    const now = new Date().toISOString();
    const { data, error } = await db().from("tasks").update({ closed_at: now, acknowledged_at: now }).eq("id", id).select("session_id");
    must({ error }, "close task");
    if (data?.[0]) await audit(staff, task?.type === "supervisor_review" ? "supervisor_reviewed" : "task_closed", "task", id, data[0].session_id);
  });
}

const DecideInput = z
  .object({
    sessionId: uuid,
    proposalId: uuid,
    action: z.enum(["accept", "override"]),
    newStep: z.number().int().min(0).max(4).nullable(),
    reason: z.string().trim().max(500),
  })
  .refine((d) => d.action === "accept" || (d.newStep !== null && d.reason.length > 0), "An override needs a new step and a reason.");

/** Accept is one click; an override needs a new step and a reason (logged for audit). */
export async function decide(input: unknown): Promise<Result> {
  const parsed = DecideInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "An override needs a new step and a reason." };
  const d = parsed.data;
  return run(async (staff) => {
    await caseId(staff, d.sessionId);
    const own = await db().from("triage_proposals").select("id").eq("id", d.proposalId).eq("session_id", d.sessionId).limit(1);
    if (!own.data?.length) throw new UserError("Proposal not found.");
    must(
      await db().from("clinician_decisions").insert({
        proposal_id: d.proposalId, action: d.action, clinician_id: staff.id,
        new_step: d.action === "override" ? d.newStep : null, reason: d.action === "override" ? d.reason : null,
      }),
      "decision",
    );
    await addReceipt(d.sessionId, "reviewed");
    await addReceipt(d.sessionId, d.action === "accept" ? "accepted" : "re_routed", d.action === "override" ? d.reason : null);
    await audit(staff, `proposal_${d.action}`, "triage_proposal", d.proposalId, d.sessionId, { newStep: d.newStep, reason: d.reason });
    // Lowering urgency on a safety-flagged case needs the duty supervisor's co-sign.
    const [{ data: proposal }, { data: flags }] = await Promise.all([
      db().from("triage_proposals").select("urgent").eq("id", d.proposalId).single(),
      db().from("red_flag_events").select("id").eq("session_id", d.sessionId).limit(1),
    ]);
    if (needsCoSign({ hasRedFlag: (flags ?? []).length > 0, proposalUrgent: Boolean(proposal?.urgent), decision: d.action })) {
      const why = "Co-sign: urgency lowered on a safety-flagged case (step " + d.newStep + "; reason: " + d.reason + ")";
      await raiseSupervisorReview(d.sessionId, "co_sign", why, staff.role + ":" + staff.id, staff.id);
    }
  });
}

/** Opening a case starts the review timer and stores the draft summary once. */
export async function startReview(sessionId: string): Promise<{ created: boolean }> {
  const staff = await requireStaff();
  const id = await caseId(staff, sessionId);
  // Log the visit and check for a summary at the same time; build the draft only when there is none yet.
  const [existing] = await Promise.all([
    db().from("summaries").select("session_id").eq("session_id", id).limit(1),
    audit(staff, "case_viewed", "session", id, id),
  ]);
  if (!canWrite(staff) || (existing.data?.length ?? 0) > 0) return { created: false };
  const data = await loadCase(id, scopeOf(staff));
  if (!data || data.summary) return { created: false };
  must(
    await db().from("summaries").insert({ session_id: id, draft: { lines: data.draftLines }, review_started_at: new Date().toISOString() }),
    "summary",
  );
  return { created: true };
}

export async function saveSummary(sessionId: string, text: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const clean = z.string().trim().min(1).max(4000).parse(text);
    must(
      await db().from("summaries").update({ edited: { text: clean }, updated_at: new Date().toISOString() }).eq("session_id", id).is("signed_at", null),
      "save summary",
    );
    await audit(staff, "summary_edited", "summary", id, id);
  });
}

/** Signing marks the summary "AI-drafted, clinician-verified" and stops the review timer. */
export async function signSummary(sessionId: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const data = await loadCase(id, scopeOf(staff));
    if (!data?.summary) throw new Error("no summary");
    const now = new Date();
    const update: Record<string, unknown> = { signed_at: now.toISOString(), signed_by: staff.id, updated_at: now.toISOString() };
    if (!data.summary.edited) update.edited = { text: summaryToText(data.draftLines) };
    must(await db().from("summaries").update(update).eq("session_id", id).is("signed_at", null), "sign");
    const started = data.summary.review_started_at ? new Date(data.summary.review_started_at) : null;
    await audit(staff, "summary_signed", "summary", id, id, {
      review_seconds: started ? Math.round((now.getTime() - started.getTime()) / 1000) : null,
    });
  });
}

export async function setReceiptStatus(sessionId: string, status: "booked" | "first_contact_confirmed"): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const s = z.enum(["booked", "first_contact_confirmed"]).parse(status);
    await addReceipt(id, s);
    await audit(staff, `receipt_${s}`, "session", id, id);
  });
}

export async function logContact(sessionId: string, outcome: "called_no_answer" | "spoke", note: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const o = z.enum(["called_no_answer", "spoke"]).parse(outcome);
    must(
      await db().from("contact_attempts").insert({ session_id: id, outcome: o, note: note.trim().slice(0, 500) || null, clinician_id: staff.id }),
      "contact",
    );
    await addReceipt(id, o === "spoke" ? "spoke" : "contact_attempted");
    await audit(staff, "contact_logged", "session", id, id, { outcome: o });
  });
}

/** A clinician can add a known BPD or ADHD history, which switches on the extra safeguards. */
export async function addHistory(sessionId: string, kind: "bpd" | "adhd"): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const k = z.enum(["bpd", "adhd"]).parse(kind);
    must(
      await db().from("sessions").update({ [k === "bpd" ? "history_bpd" : "history_adhd"]: true, history_source: "clinician" }).eq("id", id),
      "history",
    );
    await audit(staff, "history_added", "session", id, id, { kind: k });
  });
}

/**
 * Finishes a patient's held deletion request once the care team has been in
 * touch: only after the patient asked, and only when no red flag is still open.
 */
export async function deleteCaseData(sessionId: string): Promise<Result> {
  const staff = await requireStaff();
  if (!canWrite(staff)) return { ok: false, error: "This account can view cases but not change them." };
  try {
    const id = await caseId(staff, sessionId);
    const asked = await db().from("audit_events").select("id").eq("session_id", id).eq("action", "deletion_requested").limit(1);
    must(asked, "read request");
    if (!asked.data?.length) return { ok: false, error: "The patient hasn't asked for their data to be deleted." };
    const openFlags = await db().from("tasks").select("id").eq("session_id", id).eq("type", "red_flag").is("closed_at", null).limit(1);
    must(openFlags, "read red flags");
    if (openFlags.data?.length) return { ok: false, error: "Close the red flag task first, once you've been in touch." };
    must(await db().from("audit_events").delete().eq("session_id", id), "delete audit lines");
    must(await db().from("sessions").delete().eq("id", id), "delete session");
    await audit(staff, "data_deleted", "session", "deleted", null);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "That didn't work. Please try again." };
  }
}

/** Refers the person to a service from the directory; their receipt shows where and what happens next. */
export async function referToService(sessionId: string, serviceId: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const service = serviceById(serviceId);
    if (!service) throw new Error("unknown service");
    // Urgent if the case ever had an urgent or imminent task: it then returns to the queue after 48 h without progress.
    const urgentTasks = await db().from("tasks").select("id").eq("session_id", id).in("priority", ["urgent", "imminent"]).limit(1);
    must(urgentTasks, "read urgency");
    await referral.createReferral(`${staff.role}:${staff.id}`, id, service.id, (urgentTasks.data ?? []).length > 0);
  });
}

/** Referral steps after the patient is referred: booked (with date), first contact, closed. */
export async function updateReferral(sessionId: string, step: "booked" | "first_contact" | "closed", bookedFor?: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const row = await referral.latestReferral(id);
    if (!row || row.status === "closed") throw new Error("no open referral");
    const actor = `${staff.role}:${staff.id}`;
    if (step === "booked") await referral.setBooked(actor, row, z.iso.date().parse(bookedFor));
    else if (step === "first_contact") await referral.setFirstContact(actor, row);
    else await referral.closeReferral(actor, row);
  });
}

/** Read-only, for the console alert: open imminent tasks nobody has acknowledged yet. */
export async function imminentAlerts(): Promise<{ id: string; sessionId: string; createdAt: string }[]> {
  const staff = await requireStaff();
  return loadImminentAlerts(scopeOf(staff));
}

/** "Reply to patient": a short message the person sees on their receipt timeline. */
export async function replyToPatient(sessionId: string, body: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const text = z.string().trim().min(3).max(1000).parse(body);
    must(await db().from("patient_messages").insert({ session_id: id, body: text, sent_by: staff.id }), "message");
    // A reply answers the person's message: close any open "Message from patient" task.
    const now = new Date().toISOString();
    must(
      await db()
        .from("tasks")
        .update({ acknowledged_at: now, closed_at: now })
        .eq("session_id", id)
        .eq("type", "patient_message")
        .is("closed_at", null),
      "close message task",
    );
    await audit(staff, "patient_message_sent", "session", id, id, { length: text.length });
  });
}

/**
 * "Change urgency": the clinician's judgement over the rules' tier. Moves every
 * open task to the new priority and restarts its clock; the reason is required
 * and kept in the audit trail.
 */
export async function changeUrgency(sessionId: string, priority: string, reason: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const to = z.enum(["imminent", "urgent", "elevated", "normal"]).parse(priority);
    const why = z.string().trim().min(5).max(500).parse(reason);
    const now = new Date();
    const due = to === "normal" ? nextWorkingDay(now) : dueAt(to, now);
    const { data, error } = await db()
      .from("tasks")
      .update({ priority: to, due_at: due.toISOString() })
      .eq("session_id", id)
      .is("closed_at", null)
      .select("id");
    must({ error }, "change urgency");
    if (!data?.length) throw new Error("no open tasks");
    await audit(staff, "urgency_changed", "session", id, id, { to, reason: why });
  });
}

/** "Mark reviewed": acknowledges and closes the case's open tasks (it leaves the queue). */
export async function markReviewed(sessionId: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const now = new Date().toISOString();
    must(await db().from("tasks").update({ acknowledged_at: now, acknowledged_by: staff.id }).eq("session_id", id).is("acknowledged_at", null).is("closed_at", null), "acknowledge");
    must(await db().from("tasks").update({ closed_at: now }).eq("session_id", id).is("closed_at", null), "close");
    await audit(staff, "case_reviewed", "session", id, id);
  });
}

/** "Report adverse event": counted on the service overview; linked to a case when there is one. */
export async function reportAdverseEvent(input: unknown): Promise<Result> {
  return run(async (staff) => {
    const d = z
      .object({
        sessionId: z.string().uuid().nullable(),
        category: z.enum(["self_harm", "harm_to_others", "missed_urgent_contact", "care_delay", "privacy", "other"]),
        severity: z.enum(["low", "moderate", "severe"]),
        description: z.string().trim().min(5).max(2000),
      })
      .parse(input);
    if (d.sessionId) await caseId(staff, d.sessionId);
    must(
      await db().from("adverse_events").insert({ session_id: d.sessionId, category: d.category, severity: d.severity, description: d.description, reported_by: staff.id }),
      "adverse event",
    );
    await audit(staff, "adverse_event_reported", "adverse_event", d.sessionId ?? "service", d.sessionId, { category: d.category, severity: d.severity });
    // Every adverse event on a case goes to the duty supervisor.
    if (d.sessionId) {
      const why = "Adverse event reported: " + d.category.replaceAll("_", " ") + " (" + d.severity + ")";
      await raiseSupervisorReview(d.sessionId, "adverse_event_" + Date.now(), why, staff.role + ":" + staff.id);
    }
  });
}

// ---------------------------------------------------------------------------
// Case closure and follow-up link
// ---------------------------------------------------------------------------

const CloseInput = z.object({
  sessionId: uuid,
  reason: z.enum(Object.keys(CLOSURE_REASONS) as [ClosureReason, ...ClosureReason[]]),
  notNeeded: z.array(z.enum(Object.keys(CLOSURE_STEPS) as [ClosureStep, ...ClosureStep[]])),
});

/**
 * Closes a case: reason required; summary signed; every step done or marked not
 * needed; never while a safety flag is open or an urgent hand-off is stalled.
 * Cases that had a crisis get check-ins scheduled at 7 and 30 days.
 */
export async function closeCase(input: unknown): Promise<Result> {
  const parsed = CloseInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a closure reason." };
  const d = parsed.data;
  return run(async (staff) => {
    await caseId(staff, d.sessionId);
    const state = await closureState(d.sessionId, staff.role === "supervisor", staff.id, scopeOf(staff));
    const verdict = canCloseCase(state, d.reason, d.notNeeded);
    if (!verdict.ok) throw new UserError(verdict.blockers.join(". ") + ".");
    const now = new Date();
    must(
      await db().from("sessions").update({ closed_at: now.toISOString(), closure_reason: d.reason, closed_by: staff.id }).eq("id", d.sessionId),
      "close case",
    );
    must(
      await db().from("tasks").update({ closed_at: now.toISOString(), acknowledged_at: now.toISOString() }).eq("session_id", d.sessionId).is("closed_at", null),
      "close tasks",
    );
    await audit(staff, "case_closed", "session", d.sessionId, d.sessionId, { reason: d.reason, not_needed: d.notNeeded });
    const checkIns = postCrisisCheckIns(now, state.hadCrisis);
    if (checkIns.length) {
      must(
        await db().from("tasks").insert(
          checkIns.map((due, i) => ({
            session_id: d.sessionId,
            type: "post_crisis_checkin",
            priority: "elevated",
            due_at: due.toISOString(),
            reason: "post_crisis: " + ESCALATION.postCrisisCheckInDays[i] + "-day check-in after a crisis",
          })),
        ),
        "post-crisis check-ins",
      );
      await audit(staff, "post_crisis_checkins_scheduled", "session", d.sessionId, d.sessionId, { days: ESCALATION.postCrisisCheckInDays });
    }
  });
}

/** What the closure rules need to know about a case. */
async function closureState(sessionId: string, bySupervisor: boolean, currentUserId: string, scope: Scope) {
  const [data, handoff] = await Promise.all([loadCase(sessionId, scope), latestReferralRow(sessionId)]);
  if (!data) throw new UserError("Case not found.");
  return closureStateFrom(data, handoff, bySupervisor, currentUserId);
}

/**
 * "Request supervisor co-sign": a crisis case closed as declined or unreachable
 * needs the duty supervisor, and a different person from whoever asked.
 */
export async function requestClosureCoSign(sessionId: string, reason: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const r = z.enum(["declined", "unreachable"]).parse(reason);
    await raiseSupervisorReview(id, "closure_cosign", "Co-sign closing as " + r + " (requested by a clinician)", staff.role + ":" + staff.id, staff.id);
  });
}

/** The clinician copied the follow-up link and sent it themselves (automatic sending is a pilot step). */
export async function logFollowUpLinkSent(sessionId: string, how: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const channel = z.enum(["phone", "sms", "whatsapp", "email", "in_person"]).parse(how);
    await audit(staff, "follow_up_link_sent", "session", id, id, { channel });
  });
}

// ---------------------------------------------------------------------------
// Discreet messages staff send themselves, and a new return code
// ---------------------------------------------------------------------------

const MESSAGE_KINDS = ["reply", "followup", "reminder_booking", "reminder_attended", "closing"] as const;
const SEND_CHANNELS = ["sms", "whatsapp", "email", "phone", "in_person"] as const;

/**
 * "Log message sent": the clinician copied a discreet message and sent it
 * themselves. A "Send reminder" task it answers is closed. Every patient
 * message is sent manually in the prototype; automatic sending is a pilot step.
 */
export async function logPatientNotification(sessionId: string, kind: string, channel: string, taskId?: string): Promise<Result> {
  return run(async (staff) => {
    const id = await caseId(staff, sessionId);
    const k = z.enum(MESSAGE_KINDS).parse(kind);
    const ch = z.enum(SEND_CHANNELS).parse(channel);
    if (taskId) {
      const now = new Date().toISOString();
      must(
        await db().from("tasks").update({ acknowledged_at: now, closed_at: now }).eq("id", await taskInScope(staff, taskId)).eq("session_id", id).eq("type", "send_reminder"),
        "close reminder task",
      );
    }
    await audit(staff, "patient_notified_" + k, "session", id, id, { channel: ch });
  });
}

/**
 * "Send new return code": only through a channel the person shared and still
 * allows. The old code stops working. The code is never shown on screen: the
 * message containing it is returned once, straight to the clipboard.
 */
export async function sendNewReturnCode(sessionId: string, channel: string, origin: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const staff = await requireStaff();
  if (!canWrite(staff)) return { ok: false, error: "This account can view cases but not change them." };
  try {
    const id = await caseId(staff, sessionId);
    const ch = z.enum(["sms", "whatsapp", "email"]).parse(channel);
    const [consents, session] = await Promise.all([
      persist.getConsents(id),
      db().from("sessions").select("contact_phone, contact_email").eq("id", id).single(),
    ]);
    const allowed = allowedChannels(consents);
    const hasAddress = ch === "email" ? Boolean(session.data?.contact_email) : Boolean(session.data?.contact_phone);
    if (!allowed.includes(ch) || !hasAddress) return { ok: false, error: "The person hasn't shared and allowed this channel." };
    const code = await persist.issueReturnCode(id);
    await audit(staff, "return_code_reissued", "session", id, id, { channel: ch });
    const base = z.url().parse(origin);
    const message = newCodeMessage(ch, caseRef(id), base + "/return", code);
    return { ok: true, message };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "That didn't work. Please try again." };
  }
}

/** Guest only: put the demo cases back to their starting state (the same reset runs daily). */
export async function resetDemoData(): Promise<Result> {
  return run(async (staff) => {
    if (!staff.demo) throw new UserError("Only the guest account can reset demo data.");
    must(await db().rpc("reset_demo_data"), "reset demo data");
  });
}
