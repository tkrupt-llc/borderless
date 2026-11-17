"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { db } from "@/lib/db/server";
import { canWrite, requireStaff, type Staff } from "@/lib/staff/auth";
import { loadCase } from "@/lib/staff/data";
import { summaryToText } from "@/lib/summary/build";

// Every action checks the signed-in role, writes with the service client and
// leaves an audit entry. Judges can view but not change anything.

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();

function must(result: { error: { message: string } | null }, what: string) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
}

async function audit(staff: Staff, action: string, objectType: string, objectId: string, sessionId: string | null, metadata: object = {}) {
  must(
    await db().from("audit_events").insert({
      actor: `${staff.role}:${staff.id}`, action, object_type: objectType, object_id: objectId, session_id: sessionId, metadata,
    }),
    "audit",
  );
}

async function run(fn: (staff: Staff) => Promise<void>): Promise<Result> {
  const staff = await requireStaff();
  if (!canWrite(staff)) return { ok: false, error: "This account can view cases but not change them." };
  try {
    await fn(staff);
    refresh();
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "That didn't save. Please try again." };
  }
}

async function addReceipt(sessionId: string, status: string, reason: string | null = null) {
  must(await db().from("receipt_events").insert({ session_id: sessionId, status, reason }), "receipt");
}

export async function acknowledgeTask(taskId: string): Promise<Result> {
  return run(async (staff) => {
    const id = uuid.parse(taskId);
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

export async function closeTask(taskId: string): Promise<Result> {
  return run(async (staff) => {
    const id = uuid.parse(taskId);
    const { data, error } = await db().from("tasks").update({ closed_at: new Date().toISOString() }).eq("id", id).select("session_id");
    must({ error }, "close task");
    if (data?.[0]) await audit(staff, "task_closed", "task", id, data[0].session_id);
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
  });
}

/** Opening a case starts the review timer and stores the draft summary once. */
export async function startReview(sessionId: string): Promise<{ created: boolean }> {
  const staff = await requireStaff();
  const id = uuid.parse(sessionId);
  // Log the visit and check for a summary at the same time; build the draft only when there is none yet.
  const [existing] = await Promise.all([
    db().from("summaries").select("session_id").eq("session_id", id).limit(1),
    audit(staff, "case_viewed", "session", id, id),
  ]);
  if (!canWrite(staff) || (existing.data?.length ?? 0) > 0) return { created: false };
  const data = await loadCase(id);
  if (!data || data.summary) return { created: false };
  must(
    await db().from("summaries").insert({ session_id: id, draft: { lines: data.draftLines }, review_started_at: new Date().toISOString() }),
    "summary",
  );
  return { created: true };
}

export async function saveSummary(sessionId: string, text: string): Promise<Result> {
  return run(async (staff) => {
    const id = uuid.parse(sessionId);
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
    const id = uuid.parse(sessionId);
    const data = await loadCase(id);
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
    const id = uuid.parse(sessionId);
    const s = z.enum(["booked", "first_contact_confirmed"]).parse(status);
    await addReceipt(id, s);
    await audit(staff, `receipt_${s}`, "session", id, id);
  });
}

export async function logContact(sessionId: string, outcome: "called_no_answer" | "spoke", note: string): Promise<Result> {
  return run(async (staff) => {
    const id = uuid.parse(sessionId);
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
    const id = uuid.parse(sessionId);
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
    const id = uuid.parse(sessionId);
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
