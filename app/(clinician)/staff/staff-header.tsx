import Link from "next/link";
import { Logo } from "@/components/logo";
import type { Staff } from "@/lib/staff/auth";
import { signOut } from "./login/actions";

export function StaffHeader({ staff }: { staff: Staff }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-warm pb-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Logo />
        <nav aria-label="Console" className="flex gap-5 text-caption">
          <Link href="/staff">Queue</Link>
          <Link href="/staff?view=escalated">Escalated</Link>
        </nav>
      </div>
      <form action={signOut} className="flex items-center gap-3 text-caption text-muted">
        <span>
          {staff.email} · {staff.role}
        </span>
        <button type="submit" className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 font-medium text-ink">
          Sign out
        </button>
      </form>
    </header>
  );
}

export const TASK_LABELS: Record<string, string> = {
  red_flag: "Red flag",
  talk_to_person: "Talk to a person",
  callback: "Call-back request",
  care_request: "Check-in to review",
  not_helping: "Coping card not helping",
  not_on_track: "Not on track",
};

/** Tier names in clinical words; red only for imminent (research: tiered alerts). */
export function PriorityBadge({ priority }: { priority: string }) {
  const style =
    priority === "imminent"
      ? "bg-danger text-white"
      : priority === "urgent"
        ? "bg-ink text-white"
        : priority === "elevated"
          ? "bg-sage text-ink"
          : "border border-line bg-surface text-ink";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-small font-semibold ${style}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}
