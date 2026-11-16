import Link from "next/link";
import type { Staff } from "@/lib/staff/auth";
import { signOut } from "./login/actions";

/**
 * Console frame: a fixed side bar (navigation, who is signed in) and the work
 * area. Same muted palette as the patient app; red is kept for imminent risk.
 */
export function StaffShell({
  staff,
  active,
  counts,
  children,
}: {
  staff: Staff;
  active: "queue" | "escalated" | "case";
  counts?: { open: number; escalated: number };
  children: React.ReactNode;
}) {
  const item = (on: boolean) =>
    `flex min-h-11 items-center justify-between rounded-lg px-3 text-[0.9375rem] no-underline ${
      on ? "bg-white/12 font-semibold text-white hover:text-white" : "text-on-dark-2 hover:bg-white/8 hover:text-white"
    }`;
  const count = "rounded-full bg-white/15 px-2 py-0.5 text-[0.75rem] font-semibold text-white tabular-nums";
  return (
    <div className="flex min-h-dvh w-full flex-col font-sans text-[0.9375rem] leading-normal lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 bg-ink px-4 py-4 text-on-dark lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:py-6">
        <div className="flex items-center gap-2 px-2">
          <svg width="24" height="24" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M32.3 9.7 A16 16 0 1 0 32.3 30.3" fill="none" stroke="#C8D3B0" strokeWidth="5" strokeLinecap="round" />
            <circle cx="27" cy="20" r="3.6" fill="var(--clay)" />
          </svg>
          <span className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-white">borderless</span>
          <span className="rounded bg-white/12 px-1.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap text-on-dark-2">Care team</span>
        </div>
        <nav aria-label="Console" className="flex gap-1 lg:flex-col">
          <Link href="/staff" className={item(active === "queue")} aria-current={active === "queue" ? "page" : undefined}>
            <span>Queue</span>
            {counts && <span className={count}>{counts.open}</span>}
          </Link>
          <Link href="/staff?view=escalated" className={item(active === "escalated")} aria-current={active === "escalated" ? "page" : undefined}>
            <span>Escalated</span>
            {counts && counts.escalated > 0 && <span className={`${count} bg-danger`}>{counts.escalated}</span>}
          </Link>
        </nav>
        <form action={signOut} className="mt-auto flex items-center justify-between gap-3 border-t border-white/15 px-2 pt-4 lg:flex-col lg:items-stretch">
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[0.8125rem] text-white">{staff.email}</span>
            <span className="text-[0.75rem] text-on-dark-2 capitalize">
              {staff.role}
              {staff.role === "judge" && " · view only"}
            </span>
          </span>
          <button
            type="submit"
            className="min-h-10 cursor-pointer rounded-lg border border-white/30 px-3 text-[0.8125rem] font-medium text-white hover:bg-white/8"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-5 py-6 lg:px-8">{children}</main>
    </div>
  );
}

export const TASK_LABELS: Record<string, string> = {
  red_flag: "Red flag",
  talk_to_person: "Call-back request",
  callback: "Call-back request",
  care_request: "Check-in to review",
  not_helping: "Coping card not helping",
  not_on_track: "Not on track",
};

const TIER_STYLE: Record<string, string> = {
  imminent: "bg-danger text-white",
  urgent: "bg-ink text-white",
  elevated: "bg-sage text-ink",
  normal: "border border-line bg-surface text-text-2",
};
const TIER_WORD: Record<string, string> = { imminent: "Imminent", urgent: "Urgent", elevated: "Elevated", normal: "Routine" };

/** Tier in words plus a distinct shape, so it never relies on colour alone. Red only for imminent. */
export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.8125rem] font-semibold ${TIER_STYLE[priority] ?? TIER_STYLE.normal}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="currentColor">
        {priority === "imminent" ? (
          <path d="M5 0.5 9.8 9.5H0.2z" />
        ) : priority === "urgent" ? (
          <path d="M5 0 10 5 5 10 0 5z" />
        ) : priority === "elevated" ? (
          <circle cx="5" cy="5" r="4.5" />
        ) : (
          <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        )}
      </svg>
      {TIER_WORD[priority] ?? priority}
    </span>
  );
}
