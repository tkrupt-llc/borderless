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

export type TaskLite = { priority: string; createdAt: string; acknowledgedAt: string | null; escalatedAt: string | null; closedAt: string | null };
export type ContactLite = { outcome: "called_no_answer" | "spoke"; createdAt: string };

/**
 * An imminent task someone acknowledged, but no contact (call attempt or
 * conversation) was logged within N minutes of acknowledging it: escalate.
 */
export function contactOverdue(task: TaskLite, contacts: ContactLite[], now: Date, cfg: EscalationConfig = ESCALATION): boolean {
  if (task.priority !== "imminent" || !task.acknowledgedAt || task.escalatedAt || task.closedAt) return false;
  const ack = new Date(task.acknowledgedAt).getTime();
  if (now.getTime() - ack < cfg.imminentContactMinutes * MIN) return false;
  return !contacts.some((c) => new Date(c.createdAt).getTime() >= ack);
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
