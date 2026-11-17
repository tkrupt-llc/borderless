import { Suspense } from "react";
import Link from "next/link";
import { canWrite, requireStaff } from "@/lib/staff/auth";
import { loadQueue, type QueueTask } from "@/lib/staff/data";
import { caseRef } from "@/lib/case-ref";
import { clinicById } from "@/lib/clinics";
import { StaffShell, TASK_LABELS } from "./staff-header";
import { AutoRefresh, TimeLeft } from "./ui";
import { CaseWorkspace } from "./case-workspace";

// The review workspace (design canvas: queue → case → act). Middle pane: the
// queue, most urgent first, grouped by urgency. Right pane: the selected case
// and its actions.

type CaseRow = { sessionId: string; path: string; clinicId: string | null; tasks: QueueTask[]; top: QueueTask; receivedAt: string; unacked: number; escalated: boolean };
function byCase(tasks: QueueTask[]): CaseRow[] {
  const rows = new Map<string, CaseRow>();
  for (const t of tasks) {
    // Tasks arrive sorted by urgency, then time left, so the first one per case leads.
    const row = rows.get(t.sessionId) ?? { sessionId: t.sessionId, path: t.path, clinicId: t.clinicId, tasks: [], top: t, receivedAt: t.createdAt, unacked: 0, escalated: false };
    row.tasks.push(t);
    if (t.createdAt < row.receivedAt) row.receivedAt = t.createdAt;
    if (!t.acknowledgedAt) row.unacked += 1;
    if (t.escalatedAt) row.escalated = true;
    rows.set(t.sessionId, row);
  }
  return [...rows.values()];
}

const GROUPS = [
  { id: "imminent", title: "Imminent · act now", head: "bg-danger text-white", row: "bg-[#fbedec] shadow-[inset_3px_0_0_var(--danger)]", time: "font-bold text-danger" },
  { id: "urgent", title: "Urgent · within 4 hours", head: "bg-[#fbf3ec] text-[#6b3e1c]", row: "", time: "font-semibold text-[#6b3e1c]" },
  { id: "elevated", title: "Elevated · today", head: "bg-[#f4f2fa] text-[#463c6e]", row: "", time: "font-semibold text-[#463c6e]" },
  { id: "normal", title: "Routine · 1 working day", head: "bg-[#f5f7f8] text-[#34505b]", row: "", time: "text-muted" },
];
const VIEWS: Record<string, { title: string; match: (c: CaseRow) => boolean }> = {
  all: { title: "Review", match: () => true },
  escalated: { title: "Escalated", match: (c) => c.escalated },
  followups: { title: "Follow-ups", match: (c) => c.path === "followup" || c.tasks.some((t) => t.type === "not_on_track") },
};
const pathLabel = (p: string) =>
  p === "contact" ? "Call-back only" : p === "followup" ? "Follow-up" : p === "crisis" ? "Crisis page" : `${p[0].toUpperCase()}${p.slice(1)} check-in`;
const received = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default function QueuePage({ searchParams }: PageProps<"/staff">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading the queue…</p>}>
      <Queue searchParams={searchParams} />
    </Suspense>
  );
}

async function Queue({ searchParams }: { searchParams: PageProps<"/staff">["searchParams"] }) {
  const staff = await requireStaff();
  const params = await searchParams;
  const viewId = typeof params.view === "string" && params.view in VIEWS ? params.view : "all";
  const view = VIEWS[viewId];
  const notFound = typeof params.notfound === "string" ? params.notfound : null;
  const tab = typeof params.tab === "string" && ["summary", "answers", "history"].includes(params.tab) ? params.tab : "summary";
  const all = byCase(await loadQueue());
  const order = GROUPS.map((g) => g.id);
  const shown = all
    .filter(view.match)
    .sort((a, b) => order.indexOf(a.top.priority) - order.indexOf(b.top.priority) || a.top.dueAt.localeCompare(b.top.dueAt));
  const selectedId = typeof params.case === "string" && shown.some((c) => c.sessionId === params.case) ? params.case : shown[0]?.sessionId;
  const selected = shown.find((c) => c.sessionId === selectedId);
  const href = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v && !(k === "view" && v === "all")) p.set(k, v);
    const s = p.toString();
    return s ? `/staff?${s}` : "/staff";
  };
  const next = shown.find((c) => c.sessionId !== selectedId);

  return (
    <StaffShell
      staff={staff}
      bare
      active={viewId === "escalated" ? "escalated" : viewId === "followups" ? "followups" : "queue"}
      counts={{ open: all.length, escalated: all.filter((c) => c.escalated).length, followups: all.filter(VIEWS.followups.match).length }}
    >
      <div className="flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh-3.5rem)] lg:flex-none lg:flex-row lg:overflow-hidden">
        {/* ---------------------------------------------------- queue pane */}
        <section aria-label="Review queue" className="flex shrink-0 flex-col border-line-warm bg-surface lg:w-[360px] lg:border-e">
          <div className="border-b border-line-warm px-4 pt-[18px] pb-3">
            <div className="flex items-baseline justify-between gap-2">
              <h1 className="font-serif text-[1.625rem] leading-tight font-normal">
                {view.title} <em className="text-blue">{viewId === "all" ? "queue" : "cases"}</em>
              </h1>
              <AutoRefresh />
            </div>
            <p className="mt-0.5 text-[0.8125rem] text-muted">Most urgent first · sorted by time left · synthetic data</p>
            {notFound !== null && (
              <p role="status" className="mt-2 rounded-lg bg-sage-soft px-3 py-2 text-[0.8125rem]">
                {notFound ? `No case found for ${notFound}.` : "Type a case reference to search."} References look like BL-AF09B5.
              </p>
            )}
          </div>
          <div className="lg:flex-1 lg:overflow-y-auto">
            {GROUPS.map((g) => {
              const rows = shown.filter((c) => c.top.priority === g.id);
              if (rows.length === 0) return null;
              return (
                <div key={g.id}>
                  <h2 className={`sticky top-0 z-[1] px-4 py-1.5 text-[0.75rem] font-semibold tracking-[0.02em] ${g.head}`}>
                    {g.title} <span className="font-medium">· {rows.length}</span>
                  </h2>
                  <ul>
                    {rows.map((c) => {
                      const on = c.sessionId === selectedId;
                      const clinic = clinicById(c.clinicId);
                      return (
                        <li key={c.sessionId}>
                          <Link
                            href={href({ view: viewId, case: c.sessionId })}
                            scroll={false}
                            aria-current={on ? "true" : undefined}
                            className={`block border-b border-[#eef2f4] px-4 py-3 text-ink no-underline transition-colors hover:bg-[#f2f7f9] hover:text-ink ${
                              on ? "bg-[#e3edf1] shadow-[inset_3px_0_0_var(--blue)]" : g.row
                            }`}
                          >
                            <span className="flex items-baseline justify-between gap-2">
                              <strong className="text-[0.875rem] tabular-nums">{caseRef(c.sessionId)}</strong>
                              <TimeLeft dueAt={c.top.dueAt} className={`text-[0.75rem] whitespace-nowrap ${g.time}`} />
                            </span>
                            <span className="mt-0.5 block text-[0.8125rem] text-text-2">
                              {c.tasks.map((t) => TASK_LABELS[t.type] ?? t.type).join(" · ")}
                              {c.top.ruleId && ` · ${c.top.ruleId}`}
                            </span>
                            <span className="mt-0.5 block text-[0.75rem] text-muted">
                              {pathLabel(c.path)}
                              {clinic && ` · via ${clinic.name}`} · {received(c.receivedAt)}
                              {c.escalated && <strong className="font-semibold text-danger"> · Escalated</strong>}
                              {!c.escalated && c.unacked > 0 && <strong className="font-semibold text-ink"> · New</strong>}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {shown.length === 0 && (
              <div className="anim-pop px-5 py-10 text-center text-text-2">
                <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="mx-auto">
                  <circle cx="28" cy="28" r="26" fill="var(--sky)" />
                  <path d="M18 29l7 7 13-15" fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="mt-2.5 font-semibold text-ink">Queue clear</p>
                <p className="mt-0.5 text-[0.8125rem]">{viewId === "all" ? "No open cases right now." : "Nothing here right now."}</p>
              </div>
            )}
          </div>
        </section>

        {/* ----------------------------------------------------- case pane */}
        <div className="min-w-0 flex-1 lg:overflow-y-auto">
          {selected ? (
            <CaseWorkspace
              key={selected.sessionId}
              sessionId={selected.sessionId}
              priority={selected.top.priority}
              tab={tab}
              write={canWrite(staff)}
              baseHref={href({ view: viewId, case: selected.sessionId })}
              nextHref={next ? href({ view: viewId, case: next.sessionId }) : href({ view: viewId })}
            />
          ) : (
            <p className="p-8 text-muted">Pick a case from the queue.</p>
          )}
        </div>
      </div>
    </StaffShell>
  );
}
