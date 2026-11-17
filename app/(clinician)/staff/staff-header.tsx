import Link from "next/link";
import type { Staff } from "@/lib/staff/auth";
import { signOut } from "./login/actions";
import { ImminentAlert } from "./imminent-alert";

const icon = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const InboxIcon = () => (
  <svg {...icon}>
    <path d="M3 13h5l1.5 3h5L16 13h5" />
    <path d="M5.5 5h13L21 13v6H3v-6z" />
  </svg>
);
const AlertIcon = () => (
  <svg {...icon}>
    <path d="M12 3 2.5 20h19z" />
    <path d="M12 10v4M12 17.5v.01" />
  </svg>
);
const ChartIcon = () => (
  <svg {...icon}>
    <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
  </svg>
);
const RepeatIcon = () => (
  <svg {...icon}>
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5" />
  </svg>
);
const SearchIcon = () => (
  <svg {...icon} width={16} height={16}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);

/**
 * Console frame, laid out like clinical work tools: a light side bar
 * (navigation with icons, who is signed in), a top bar (environment label and
 * case search), then the work area. Red is kept for imminent risk and overdue.
 */
export function StaffShell({
  staff,
  active,
  counts,
  bare = false,
  children,
}: {
  staff: Staff;
  active: "queue" | "escalated" | "followups" | "case" | "insights";
  counts?: { open: number; escalated: number; followups?: number };
  /** Panes fill the work area edge to edge (the review workspace). */
  bare?: boolean;
  children: React.ReactNode;
}) {
  const item = (on: boolean) =>
    `flex min-h-10 items-center gap-3 rounded-lg px-3 text-[0.875rem] no-underline ${
      on ? "bg-sage font-semibold text-text-on-sage hover:text-text-on-sage" : "font-medium text-text-2 hover:bg-sage-soft hover:text-ink"
    }`;
  const count = "ms-auto rounded-full bg-surface px-2 py-0.5 text-[0.75rem] font-semibold text-text-2 tabular-nums ring-1 ring-line";
  const initials = staff.email.slice(0, 2).toUpperCase();
  return (
    <div className="flex min-h-dvh w-full flex-col font-sans text-[0.875rem] leading-normal lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-5 border-b border-line-warm bg-surface px-3 py-4 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:border-e lg:border-b-0">
        <div className="flex h-8 items-center gap-2 px-2">
          <svg width="22" height="22" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M32.3 9.7 A16 16 0 1 0 32.3 30.3" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" />
            <circle cx="27" cy="20" r="3.6" fill="var(--clay)" />
          </svg>
          <span className="flex flex-col leading-tight">
            <span className="text-[1rem] font-semibold tracking-[-0.01em] text-ink">borderless</span>
            <span className="text-[0.75rem] text-muted">Clinician console</span>
          </span>
        </div>
        <nav aria-label="Console" className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap">
          <p className="hidden px-3 pb-1 text-[0.6875rem] font-semibold tracking-[0.06em] text-muted uppercase lg:block">Work</p>
          <Link href="/staff" className={item(active === "queue")} aria-current={active === "queue" ? "page" : undefined}>
            <InboxIcon />
            <span>Review queue</span>
            {counts && <span className={count}>{counts.open}</span>}
          </Link>
          <Link href="/staff?view=followups" className={item(active === "followups")} aria-current={active === "followups" ? "page" : undefined}>
            <RepeatIcon />
            <span>Follow-ups due</span>
            {counts?.followups ? <span className={count}>{counts.followups}</span> : null}
          </Link>
          <Link href="/staff?view=escalated" className={item(active === "escalated")} aria-current={active === "escalated" ? "page" : undefined}>
            <AlertIcon />
            <span>Escalated</span>
            {counts && counts.escalated > 0 && (
              <span className="ms-auto rounded-full bg-danger px-2 py-0.5 text-[0.75rem] font-semibold text-white tabular-nums">{counts.escalated}</span>
            )}
          </Link>
          <p className="hidden px-3 pt-3 pb-1 text-[0.6875rem] font-semibold tracking-[0.06em] text-muted uppercase lg:block">Service</p>
          <Link href="/staff/insights" className={item(active === "insights")} aria-current={active === "insights" ? "page" : undefined}>
            <ChartIcon />
            <span>Service overview</span>
          </Link>
        </nav>
        <div className="mx-1 mt-auto hidden rounded-xl bg-sage-soft px-3.5 py-3 text-[0.8125rem] text-text-2 lg:block">
          <strong className="block text-ink">Duty supervisor</strong>
          Any case that misses its reply-by time goes to them automatically.
        </div>
        <form action={signOut} className="mt-auto flex flex-col gap-3 border-t border-line-warm px-2 pt-4 lg:mt-0">
          <span className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-[0.75rem] font-semibold text-white">
              {initials}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[0.75rem] font-medium text-ink" title={staff.email}>{staff.email}</span>
              <span className="text-[0.75rem] text-muted capitalize">
                {staff.role}
                {staff.role === "judge" && " · view only"}
              </span>
            </span>
          </span>
          <button type="submit" className="min-h-9 cursor-pointer rounded-full border border-line bg-surface px-3 text-[0.8125rem] font-medium text-ink hover:bg-sage-soft">
            Sign out
          </button>
        </form>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line-warm bg-surface px-5 py-2 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-md border border-[#e3c27a] bg-[#fbefd2] px-2 py-0.5 text-[0.75rem] font-semibold text-[#5c3a00]">
            Demo environment · synthetic data only
          </span>
          <div className="flex flex-wrap items-center gap-3">
          <ImminentAlert />
          <form action="/staff/find" role="search" className="flex items-center gap-2">
            <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-bg px-3 text-muted focus-within:border-primary focus-within:bg-surface">
              <SearchIcon />
              <span className="sr-only">Find a case by reference</span>
              <input
                name="ref"
                placeholder="Find case, e.g. BL-AF09B5"
                autoComplete="off"
                spellCheck={false}
                className="w-52 bg-transparent text-[0.875rem] text-ink outline-none placeholder:text-muted"
              />
            </label>
          </form>
          </div>
        </header>
        {bare ? (
          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        ) : (
          <main className="flex min-w-0 flex-1 flex-col gap-5 px-5 py-6 lg:px-8">{children}</main>
        )}
      </div>
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
  urgent: "bg-[#f4e3d3] text-[#6b3e1c]",
  elevated: "bg-[#e9e4f5] text-[#463c6e]",
  normal: "bg-[#edf0f1] text-[#34505b]",
};
const TIER_WORD: Record<string, string> = { imminent: "Imminent", urgent: "Urgent", elevated: "Elevated", normal: "Routine" };

/** Tier in words plus a distinct shape, so it never relies on colour alone. Red only for imminent. */
export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold whitespace-nowrap ${TIER_STYLE[priority] ?? TIER_STYLE.normal}`}>
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
