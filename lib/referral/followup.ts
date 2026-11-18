import config from "@/content/rules/referral-followup.json";

/**
 * Referral follow-through. Pure and deterministic (never AI), so the rules are
 * tested on their own and the same code decides what the patient's card asks
 * and what goes back to the clinician queue.
 *
 *   referred -> booked (with date) -> first contact -> closed
 *
 * Rules (timings in content/rules/referral-followup.json):
 *   - remind:          still unbooked N days after the referral (shown on the patient's card)
 *   - stall:           still unbooked after N days, or "I need help booking" -> back to the queue as "Hand-off stalled"
 *   - ask_attendance:  N days after the booked date, ask "Did you see them?"
 *   - urgent_requeue:  an urgent referral with no progress for N hours, at any stage -> back to the queue
 * Each action fires once (its *_at column is written), so the rules are idempotent.
 */

export type FollowUpConfig = {
  reminderAfterDays: number;
  stallAfterDays: number;
  attendanceCheckAfterBookedDays: number;
  urgentRequeueHours: number;
};
export const FOLLOW_UP_CONFIG: FollowUpConfig = config;

export type ReferralStatus = "referred" | "booked" | "first_contact" | "closed";

export type Referral = {
  status: ReferralStatus;
  urgent: boolean;
  referredAt: string;
  bookedFor: string | null; // YYYY-MM-DD
  bookedAt: string | null;
  firstContactAt: string | null;
  reminderAt: string | null;
  helpRequestedAt: string | null;
  stalledAt: string | null;
  attendanceAskedAt: string | null;
  urgentRequeuedAt: string | null;
};

export type FollowUpAction = "remind" | "stall" | "ask_attendance" | "urgent_requeue";

const H = 3_600_000;
const D = 24 * H;
const ms = (iso: string) => new Date(iso).getTime();
/** The booked date is a calendar day; count from the end of that day (UAE time). */
const endOfBookedDay = (date: string) => ms(`${date}T23:59:59+04:00`);

/** When the referral entered its current stage. */
export function stageStartedAt(r: Referral): string {
  if (r.status === "first_contact" && r.firstContactAt) return r.firstContactAt;
  if (r.status === "booked" && r.bookedAt) return r.bookedAt;
  return r.referredAt;
}

/** The rules that are due now, in a fixed order. Empty once closed. */
export function dueActions(r: Referral, now: Date, cfg: FollowUpConfig = FOLLOW_UP_CONFIG): FollowUpAction[] {
  if (r.status === "closed") return [];
  const t = now.getTime();
  const out: FollowUpAction[] = [];
  if (r.status === "referred") {
    const age = t - ms(r.referredAt);
    if (!r.reminderAt && age >= cfg.reminderAfterDays * D) out.push("remind");
    if (!r.stalledAt && age >= cfg.stallAfterDays * D) out.push("stall");
  }
  if (r.status === "booked" && r.bookedFor && !r.attendanceAskedAt && t >= endOfBookedDay(r.bookedFor) + cfg.attendanceCheckAfterBookedDays * D - D) {
    out.push("ask_attendance");
  }
  if (r.urgent) {
    const stage = ms(stageStartedAt(r));
    const alreadyThisStage = r.urgentRequeuedAt !== null && ms(r.urgentRequeuedAt) >= stage;
    if (!alreadyThisStage && t - stage >= cfg.urgentRequeueHours * H) out.push("urgent_requeue");
  }
  return out;
}

export type PatientCard =
  | { kind: "ask_booked"; reminder: boolean }
  | { kind: "help_requested" }
  | { kind: "booked"; bookedFor: string | null }
  | { kind: "ask_attended"; bookedFor: string | null }
  | { kind: "done" };

/** What the "Your next step" card asks the patient right now. */
export function patientCard(r: Referral, now: Date, cfg: FollowUpConfig = FOLLOW_UP_CONFIG): PatientCard {
  if (r.status === "first_contact" || r.status === "closed") return { kind: "done" };
  if (r.status === "booked") {
    const due = r.bookedFor ? now.getTime() >= endOfBookedDay(r.bookedFor) + cfg.attendanceCheckAfterBookedDays * D - D : false;
    return r.attendanceAskedAt || due ? { kind: "ask_attended", bookedFor: r.bookedFor } : { kind: "booked", bookedFor: r.bookedFor };
  }
  if (r.helpRequestedAt) return { kind: "help_requested" };
  return { kind: "ask_booked", reminder: Boolean(r.reminderAt) || now.getTime() - ms(r.referredAt) >= cfg.reminderAfterDays * D };
}
