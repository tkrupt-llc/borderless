import { Suspense } from "react";
import Link from "next/link";
import { canWrite, requireStaff } from "@/lib/staff/auth";
import { loadQueue, loadQueueScores, type QueueTask } from "@/lib/staff/data";
import { caseRef } from "@/lib/case-ref";
import { clinicById } from "@/lib/clinics";
import { acknowledgeCase } from "./actions";
import { StaffShell, TASK_LABELS } from "./staff-header";
import { ActionButton, AutoRefresh, ReplyBy } from "./ui";
import { CaseSummaryPanel } from "./case-summary-panel";

// The review queue (DESIGN v2, mockup 08): sorted by reply-by time, imminent
// cases as a red banner on top, the rest as badges; the selected case's summary
// sits beside the list. One row per case.

/** One row per case: its most urgent task leads. */
type CaseRow = { sessionId: string; path: string; clinicId: string | null; tasks: QueueTask[]; top: QueueTask; unacked: number; escalated: boolean };
function byCase(tasks: QueueTask[]): CaseRow[] {
  const rows = new Map<string, CaseRow>();
  for (const t of tasks) {
    // Tasks arrive sorted by urgency, then time left, so the first one per case leads.
    const row = rows.get(t.sessionId) ?? { sessionId: t.sessionId, path: t.path, clinicId: t.clinicId, tasks: [], top: t, unacked: 0, escalated: false };
    row.tasks.push(t);
    if (!t.acknowledgedAt) row.unacked += 1;
    if (t.escalatedAt) row.escalated = true;
    rows.set(t.sessionId, row);
  }
  return [...rows.values()];
}

const VIEWS = [
  { id: "all", label: "All", match: () => true },
  { id: "imminent", label: "Imminent", match: (c: CaseRow) => c.top.priority === "imminent" },
  { id: "urgent", label: "Urgent", match: (c: CaseRow) => c.top.priority === "urgent" },
  { id: "elevated", label: "Elevated", match: (c: CaseRow) => c.top.priority === "elevated" },
  { id: "routine", label: "Routine", match: (c: CaseRow) => c.top.priority === "normal" },
  { id: "escalated", label: "Escalated", match: (c: CaseRow) => c.escalated, hidden: true },
  { id: "followups", label: "Follow-ups", match: (c: CaseRow) => c.path === "followup" || c.tasks.some((t) => t.type === "not_on_track"), hidden: true },
];

const pathLabel = (p: string) =>
  p === "contact" ? "Call-back only" : p === "followup" ? "Follow-up" : p === "crisis" ? "Crisis page" : `${p[0].toUpperCase()}${p.slice(1)} check-in`;

/** Arrived in the last minute: the row highlights once so the eye finds it. */
const justNow = (iso: string, nowMs: number) => nowMs - new Date(iso).getTime() < 60_000;

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
  const view = VIEWS.find((v) => v.id === String(params.view ?? "all")) ?? VIEWS[0];
  const notFound = typeof params.notfound === "string" ? params.notfound : null;
  const all = byCase(await loadQueue());
  // Sorted by reply-by time (earliest due first), imminent always on top.
  const sorted = [...all].sort(
    (a, b) => (a.top.priority === "imminent" ? 0 : 1) - (b.top.priority === "imminent" ? 0 : 1) || a.top.dueAt.localeCompare(b.top.dueAt),
  );
  const shown = sorted.filter(view.match);
  const scores = await loadQueueScores(shown.map((c) => c.sessionId));
  const selectedId = typeof params.case === "string" && shown.some((c) => c.sessionId === params.case) ? params.case : shown[0]?.sessionId;
  const selected = shown.find((c) => c.sessionId === selectedId);
  const imminent = all.filter((c) => c.top.priority === "imminent" && c.unacked > 0);
  const write = canWrite(staff);
  const nowMs = new Date().getTime();
  const href = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v && !(k === "view" && v === "all")) p.set(k, v);
    const s = p.toString();
    return s ? `/staff?${s}` : "/staff";
  };
  const followUpMatch = VIEWS.find((v) => v.id === "followups")!.match;

  return (
    <StaffShell
      staff={staff}
      active={view.id === "escalated" ? "escalated" : view.id === "followups" ? "followups" : "queue"}
      counts={{ open: all.length, escalated: all.filter((c) => c.escalated).length, followups: all.filter(followUpMatch).length }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[2.125rem] leading-tight font-normal">
            {view.id === "escalated" ? "Escalated" : view.id === "followups" ? "Follow-ups" : "Review"}{" "}
            <em className="text-blue">{view.id === "escalated" || view.id === "followups" ? "cases" : "queue"}</em>
          </h1>
          <p className="mt-1 text-[0.875rem] text-muted">Sorted by reply-by time · Synthetic demo data</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AutoRefresh />
          {!view.hidden && (
            <nav aria-label="Filter by urgency" className="flex flex-wrap gap-2">
              {VIEWS.filter((v) => !v.hidden).map((v) => {
                const on = v.id === view.id;
                return (
                  <Link
                    key={v.id}
                    href={href({ view: v.id })}
                    aria-current={on ? "page" : undefined}
                    className={`tap inline-flex min-h-10 items-center rounded-full px-3.5 text-[0.875rem] font-medium no-underline ${
                      on ? "bg-primary text-white hover:text-white" : "border border-line bg-surface text-ink hover:text-ink"
                    }`}
                  >
                    {v.label} {all.filter(v.match).length}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      {notFound !== null && (
        <p role="status" className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[0.875rem]">
          {notFound ? (
            <>
              No case found for <strong className="font-semibold">{notFound}</strong>.
            </>
          ) : (
            "Type a case reference to search."
          )}{" "}
          References look like BL-AF09B5.
        </p>
      )}

      {imminent.map((c) => (
        <div key={c.sessionId} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger px-5 py-3.5 text-white">
          <span className="flex flex-col">
            <strong className="text-[1rem] font-semibold">
              Imminent · {caseRef(c.sessionId)} · {replyIn(c.top.dueAt, nowMs)}
            </strong>
            <span className="text-[0.875rem] text-[#fbe9e7]">
              {TASK_LABELS[c.top.type] ?? c.top.type}
              {c.top.ruleId && ` · ${c.top.ruleId}`} · {pathLabel(c.path)}
            </span>
          </span>
          <Link
            href={`/staff/case/${c.sessionId}`}
            className="tap inline-flex min-h-11 items-center rounded-full bg-white px-[18px] font-semibold text-danger no-underline hover:text-danger"
          >
            Open and call now
          </Link>
        </div>
      ))}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-line-warm bg-surface px-5 py-8 text-center text-text-2">
          {view.id === "all" ? "No open cases." : `No open cases under "${view.label}".`}
        </p>
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-0 flex-[1_1_520px] overflow-x-auto rounded-2xl border border-line-warm bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
            <table className="w-full min-w-[560px] border-collapse text-left text-[0.9375rem]">
              <thead className="text-[0.8125rem] text-muted">
                <tr>
                  {["Patient", "Path", "Scores", "Reply by"].map((h) => (
                    <th key={h} scope="col" className="border-b border-line-warm px-4 py-3.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const on = c.sessionId === selectedId;
                  const clinic = clinicById(c.clinicId);
                  return (
                    <tr
                      key={c.sessionId}
                      className={`border-b border-line-warm align-top last:border-b-0 ${on ? "bg-[#eaf2f5] shadow-[inset_3px_0_0_var(--blue)]" : "hover:bg-sage-mist"} ${
                        justNow(c.top.createdAt, nowMs) ? "anim-highlight" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <Link
                          href={href({ view: view.id, case: c.sessionId })}
                          scroll={false}
                          aria-current={on ? "true" : undefined}
                          className="font-semibold whitespace-nowrap text-ink tabular-nums no-underline hover:underline"
                        >
                          {caseRef(c.sessionId)}
                        </Link>
                        <span className="block text-[0.8125rem] text-muted">{c.tasks.map((t) => TASK_LABELS[t.type] ?? t.type).join(" · ")}</span>
                        <span className={`block text-[0.75rem] font-semibold ${c.escalated ? "text-danger" : c.unacked > 0 ? "text-ink" : "text-muted"}`}>
                          {c.escalated ? "Escalated" : c.unacked > 0 ? "New" : "Acknowledged"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {pathLabel(c.path)}
                        {clinic && <span className="block text-[0.75rem] text-blue">via {clinic.name}</span>}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">{scores.get(c.sessionId) || <span className="text-muted">–</span>}</td>
                      <td className="px-4 py-3.5">
                        <ReplyBy priority={c.top.priority} dueAt={c.top.dueAt} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3 xl:sticky xl:top-6">
              <CaseSummaryPanel key={selected.sessionId} sessionId={selected.sessionId} priority={selected.top.priority} write={write} />
              {selected.unacked > 0 && write && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-warm bg-surface px-5 py-3">
                  <span className="text-[0.875rem] text-text-2">
                    {selected.unacked === 1 ? "1 task not yet acknowledged" : `${selected.unacked} tasks not yet acknowledged`}
                  </span>
                  <ActionButton action={acknowledgeCase.bind(null, selected.sessionId)}>Acknowledge</ActionButton>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </StaffShell>
  );
}

/** "reply in 11 min" for the imminent banner (the queue refreshes every few seconds). */
function replyIn(dueAt: string, nowMs: number): string {
  const mins = Math.round((new Date(dueAt).getTime() - nowMs) / 60_000);
  return mins >= 0 ? `reply in ${mins} min` : `overdue by ${-mins} min`;
}
