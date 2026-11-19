import config from "@/content/rules/escalation.json";

/**
 * Clinical-safety rules for the console. Pure and deterministic (never AI), so
 * they are tested on their own. Timings: content/rules/escalation.json (DRAFT).
 */

export type EscalationConfig = typeof config;
export const ESCALATION: EscalationConfig = config;
const MIN = 60_000;
const DAY = 86_400_000;

// --- Second escalation clock --------------------------------------------------

export type TaskLite = { priority: string; createdAt: string; dueAt?: string; acknowledgedAt: string | null; escalatedAt: string | null; closedAt: string | null };
export type ContactLite = { outcome: "called_no_answer" | "spoke"; createdAt: string };

/**
 * Acknowledged, but no contact (call attempt or conversation) logged since:
 *  - imminent: within N minutes of acknowledging (30);
 *  - urgent: by the task's own reply-by time (4 hours).
 * Either way the task escalates to the duty supervisor.
 */
export function contactOverdue(task: TaskLite, contacts: ContactLite[], now: Date, cfg: EscalationConfig = ESCALATION): boolean {
  if (!task.acknowledgedAt || task.escalatedAt || task.closedAt) return false;
  const ack = new Date(task.acknowledgedAt).getTime();
  let deadline: number;
  if (task.priority === "imminent") deadline = ack + cfg.imminentContactMinutes * MIN;
  else if (task.priority === "urgent" && task.dueAt) deadline = new Date(task.dueAt).getTime();
  else return false;
  if (now.getTime() < deadline) return false;
  return !contacts.some((c) => new Date(c.createdAt).getTime() >= ack);
}

// --- Closing a red-flag task ----------------------------------------------------------

/**
 * A red-flag task closes only after a logged conversation with the person,
 * or with the duty supervisor's sign-off and a reason.
 */
export function canCloseRedFlag(input: { spokeLogged: boolean; isSupervisor: boolean; reason: string | null | undefined }): { ok: boolean; error?: string } {
  if (input.spokeLogged) return { ok: true };
  if (!input.isSupervisor) return { ok: false, error: "Log a conversation with the person first, or ask the duty supervisor to sign it off." };
  if (!input.reason || input.reason.trim().length < 5) return { ok: false, error: "Supervisor sign-off needs a reason." };
  return { ok: true };
}

// --- Four eyes -------------------------------------------------------------------------

/** A co-sign must come from someone other than the person who asked for it. */
export function coSignAllowed(signerId: string, requesterId: string | null | undefined): boolean {
  return Boolean(requesterId) && signerId !== requesterId;
}

// --- Supervisor triggers --------------------------------------------------------

export type SupervisorTrigger = { key: string; reason: string };

/**
 * When a case needs the duty supervisor, beyond a missed reply-by time:
 *  - repeat crisis: 2+ urgent or imminent alerts for the same person within 30 days
 *  - imminent and unreachable: an imminent case with 2+ unanswered call attempts and no conversation since
 * (Co-signing a lowered urgency and adverse events are raised at the moment they happen.)
 */
export function supervisorTriggers(
  input: { crisisAlerts: { priority: string; createdAt: string }[]; hasImminent: boolean; contacts: ContactLite[] },
  now: Date,
  cfg: EscalationConfig = ESCALATION,
): SupervisorTrigger[] {
  const out: SupervisorTrigger[] = [];
  const since = now.getTime() - cfg.repeatCrisisWindowDays * DAY;
  const recent = input.crisisAlerts.filter((a) => (a.priority === "urgent" || a.priority === "imminent") && new Date(a.createdAt).getTime() >= since);
  if (recent.length >= cfg.repeatCrisisCount) {
    out.push({ key: "repeat_crisis", reason: `Repeat crisis: ${recent.length} urgent or imminent alerts in ${cfg.repeatCrisisWindowDays} days` });
  }
  if (input.hasImminent) {
    const spokeAt = Math.max(0, ...input.contacts.filter((c) => c.outcome === "spoke").map((c) => new Date(c.createdAt).getTime()));
    const missed = input.contacts.filter((c) => c.outcome === "called_no_answer" && new Date(c.createdAt).getTime() > spokeAt).length;
    if (missed >= cfg.unreachableAttempts) out.push({ key: "imminent_unreachable", reason: `Imminent case unreachable after ${missed} call attempts` });
  }
  return out;
}

/** Lowering urgency on a safety-flagged case needs a supervisor's co-sign. */
export function needsCoSign(input: { hasRedFlag: boolean; proposalUrgent: boolean; decision: "accept" | "override" }): boolean {
  return input.hasRedFlag && input.proposalUrgent && input.decision === "override";
}

// --- Case closure -----------------------------------------------------------------

export const CLOSURE_REASONS = {
  handed_off: "Handed off to a service",
  self_help_plan: "Self-help plan agreed",
  declined: "Person declined further support",
  unreachable: "Unreachable",
  data_deleted: "Person deleted their data",
} as const;
export type ClosureReason = keyof typeof CLOSURE_REASONS;

export const CLOSURE_STEPS = {
  level: "Level decided",
  contact: "Spoke with the person",
  handoff: "Hand-off closed",
} as const;
export type ClosureStep = keyof typeof CLOSURE_STEPS;

export type ClosureState = {
  summarySigned: boolean;
  steps: Record<ClosureStep, boolean>;
  /** Red-flag tasks still open. */
  openSafetyFlags: number;
  /** An urgent hand-off that went back to the queue and isn't closed. */
  urgentHandoffStalled: boolean;
  /** The case ever had an urgent or imminent alert. */
  hadCrisis: boolean;
  /** When each contact attempt (call, no answer or spoke) was logged. */
  contactAttempts: string[];
  /** A discreet closing message was sent and logged. */
  closingMessageSent: boolean;
  /** The person closing is the duty supervisor (co-signs a crisis case closed as declined or unreachable). */
  bySupervisor: boolean;
  /** Who asked for the supervisor's co-sign on closing (a clinician), if anyone. */
  coSignRequestedBy?: string | null;
  /** The person trying to close. */
  currentUserId?: string;
};

/**
 * Whether a case can close, and why not. A signed summary is always needed;
 * every other step must be done or marked "not needed"; never while a safety
 * flag is open or an urgent hand-off is stalled.
 */
export function canCloseCase(state: ClosureState, reason: string | null, notNeeded: ClosureStep[]): { ok: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!reason || !(reason in CLOSURE_REASONS)) blockers.push("Choose a closure reason");
  if (!state.summarySigned) blockers.push("Sign the summary");
  for (const step of Object.keys(CLOSURE_STEPS) as ClosureStep[]) {
    if (!state.steps[step] && !notNeeded.includes(step)) blockers.push(`${CLOSURE_STEPS[step]}: do it or mark it not needed`);
  }
  if (reason === "unreachable") {
    const times = state.contactAttempts.map((t) => new Date(t).getTime()).sort((a, b) => a - b);
    const spanDays = times.length ? (times[times.length - 1] - times[0]) / 86_400_000 : 0;
    if (times.length < ESCALATION.unreachableMinAttempts || spanDays < ESCALATION.unreachableMinDays) {
      blockers.push(`Unreachable needs ${ESCALATION.unreachableMinAttempts} logged attempts over at least ${ESCALATION.unreachableMinDays} days (${times.length} so far)`);
    }
    if (!state.closingMessageSent) blockers.push("Unreachable needs a closing message sent and logged");
  }
  if (state.hadCrisis && (reason === "declined" || reason === "unreachable")) {
    if (!state.bySupervisor) {
      blockers.push("This case had a crisis: closing it as declined or unreachable needs the duty supervisor's co-sign (request it below)");
    } else if (!coSignAllowed(state.currentUserId ?? "", state.coSignRequestedBy)) {
      blockers.push("The co-sign must come from a different person: a clinician requests closure, then a supervisor closes it");
    }
  }
  if (state.openSafetyFlags > 0) blockers.push("A safety flag is still open: close the red-flag task first");
  if (state.urgentHandoffStalled) blockers.push("An urgent hand-off is stalled: resolve it first");
  return { ok: blockers.length === 0, blockers };
}

/** Check-ins scheduled when a case that had a crisis closes (7 and 30 days). */
export function postCrisisCheckIns(closedAt: Date, hadCrisis: boolean, cfg: EscalationConfig = ESCALATION): Date[] {
  return hadCrisis ? cfg.postCrisisCheckInDays.map((d) => new Date(closedAt.getTime() + d * DAY)) : [];
}

/** Scheduled tasks stay out of the queue until shortly before they are due. */
export function isVisibleInQueue(task: { type: string; dueAt: string }, now: Date, cfg: EscalationConfig = ESCALATION): boolean {
  if (task.type !== "post_crisis_checkin") return true;
  return new Date(task.dueAt).getTime() - now.getTime() <= cfg.scheduledTaskShowHoursBefore * 3_600_000;
}
