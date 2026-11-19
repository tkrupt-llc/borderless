import type { CaseData } from "@/lib/staff/data";
import type { ReferralRow } from "@/lib/referral/persist";
import type { ClosureState } from "@/lib/staff/safety-rules";

/** Everything the closure rules need, from a loaded case. Used by the page and by the server action. */
export function closureStateFrom(data: NonNullable<CaseData>, handoff: ReferralRow | null, bySupervisor: boolean): ClosureState {
  return {
    summarySigned: Boolean(data.summary?.signed_at),
    steps: {
      level: data.decision !== null,
      contact: data.contacts.some((c) => c.outcome === "spoke"),
      handoff: !handoff || handoff.status === "closed",
    },
    openSafetyFlags: data.tasks.filter((t) => t.type === "red_flag" && !t.closed_at).length,
    urgentHandoffStalled: Boolean(handoff && handoff.urgent && handoff.stalled_at && handoff.status !== "closed"),
    hadCrisis: data.tasks.some((t) => t.priority === "urgent" || t.priority === "imminent"),
    contactAttempts: data.contacts.map((c) => c.created_at),
    closingMessageSent: data.activity.some((a) => a.action === "patient_notified_closing"),
    bySupervisor,
  };
}
