import { STEP_NAMES } from "@/lib/rules/routing";
import { nextWorkingDay } from "@/lib/rules/tiers";

/**
 * The patient's receipt timeline, built from the receipt events the care team
 * writes (research: received -> reviewed -> booked -> seen, current step
 * highlighted, an honest time estimate, never a vague "we'll be in touch").
 * Pure, so the same code runs on the server and for the local fallback.
 */

export type ReceiptInput = {
  events: { status: string; reason: string | null; createdAt: string }[];
  proposal: { step: number | null; urgent: boolean } | null;
  decision: { action: string; newStep: number | null } | null;
  followUp: boolean;
};

export type ReceiptStep = { key: string; title: string; body: string; state: "done" | "now" | "next" };
/** ref: the case reference the care team also sees (added by the server). */
export type ReceiptView = { sentAt: string; steps: ReceiptStep[]; ref?: string };

const fmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
});
export const formatWhen = (iso: string | Date) => fmt.format(typeof iso === "string" ? new Date(iso) : iso);

export function buildReceipt(input: ReceiptInput): ReceiptView | null {
  const first = (status: string) => input.events.find((e) => e.status === status);
  const last = (status: string) => input.events.findLast((e) => e.status === status);
  const received = first("received");
  if (!received) return null;

  const outcome = last("accepted") ?? last("re_routed");
  const reviewed = first("reviewed") ?? outcome;
  const booked = last("booked");
  const spoke = last("spoke");
  const firstContact = last("first_contact_confirmed") ?? spoke;
  const tried = last("contact_attempted");

  // The level the clinician settled on: their override, else the proposal they accepted.
  const step = input.decision?.action === "override" ? input.decision.newStep : (input.proposal?.step ?? null);
  const level = input.proposal?.urgent && input.decision?.action !== "override"
    ? "urgent support"
    : step !== null
      ? STEP_NAMES[step].toLowerCase()
      : null;

  const steps: (Omit<ReceiptStep, "state"> & { done: boolean })[] = [];
  const add = (key: string, title: string, body: string, done: boolean) => steps.push({ key, title, body, done });

  add("received", "Check-in sent", `Sent ${formatWhen(received.createdAt)}. Your answers are saved and private.`, true);
  add(
    "reviewed",
    reviewed ? "A clinician has read your answers" : "A clinician is reviewing your answers",
    reviewed
      ? `Reviewed ${formatWhen(reviewed.createdAt)}.`
      : `You'll hear from us by ${formatWhen(nextWorkingDay(new Date(received.createdAt)))}.`,
    Boolean(reviewed),
  );
  add(
    "outcome",
    "Your next step",
    !outcome
      ? "Your clinician will choose the right next step for you."
      : outcome.status === "re_routed"
        ? `Your clinician chose a different next step${level ? `: ${level}` : ""}.${outcome.reason ? ` Reason: ${outcome.reason}` : ""}`
        : `Your clinician agreed the next step${level ? `: ${level}` : ""}.`,
    Boolean(outcome),
  );
  add(
    "booked",
    booked ? "Booked" : "Booking",
    booked ? `Your appointment was booked ${formatWhen(booked.createdAt)}.` : "We'll confirm here when your appointment is booked.",
    Boolean(booked),
  );
  add(
    "contact",
    firstContact ? "We spoke with you" : "First contact",
    firstContact
      ? `${formatWhen(firstContact.createdAt)}.`
      : tried
        ? `We tried to call you ${formatWhen(tried.createdAt)}. We'll try again.`
        : "A clinician will contact you.",
    Boolean(firstContact),
  );
  if (input.followUp) add("follow_up", "Follow-up check-in", "In about 4 weeks. Use your follow-up link.", false);

  // The first step not yet done is "now"; later ones are "next".
  let nowGiven = false;
  return {
    sentAt: received.createdAt,
    steps: steps.map(({ done, ...s }) => {
      if (done) return { ...s, state: "done" as const };
      if (!nowGiven && s.key !== "follow_up") {
        nowGiven = true;
        return { ...s, state: "now" as const };
      }
      return { ...s, state: "next" as const };
    }),
  };
}
