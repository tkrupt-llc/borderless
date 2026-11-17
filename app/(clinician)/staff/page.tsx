import { Suspense } from "react";
import Link from "next/link";
import { canWrite, requireStaff } from "@/lib/staff/auth";
import { loadQueue, type QueueTask } from "@/lib/staff/data";
import { caseRef } from "@/lib/case-ref";
import { acknowledgeCase } from "./actions";
import { PriorityBadge, StaffShell, TASK_LABELS } from "./staff-header";
import { ActionButton, AutoRefresh, Countdown } from "./ui";

const received = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// The queue is a scanning tool (research): one row per case, grouped by
// urgency; each row says which case, why, and what to do next.
const GROUPS = [
  { tiers: ["imminent"], title: "Act now", note: "Respond within 15 minutes" },
  { tiers: ["urgent"], title: "Act today", note: "Respond within 4 hours" },
  { tiers: ["elevated", "normal"], title: "Routine", note: "Respond within one working day" },
];
const FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "flags", label: "Red flags", match: (t: QueueTask) => t.type === "red_flag" },
  { id: "reviews", label: "Check-ins", match: (t: QueueTask) => t.type === "care_request" || t.type === "not_on_track" },
  { id: "calls", label: "Call-backs", match: (t: QueueTask) => t.type === "talk_to_person" || t.type === "callback" || t.type === "not_helping" },
  { id: "escalated", label: "Escalated", match: (t: QueueTask) => Boolean(t.escalatedAt) },
];

function nextAction(t: QueueTask): string {
  if (t.type === "red_flag") return t.hasPhone ? "Call the patient" : "Review now (no phone shared)";
  if (t.type === "talk_to_person" || t.type === "callback") return "Call back";
  if (t.type === "care_request") return "Review and choose the next step";
  if (t.type === "not_on_track") return t.hasPhone ? "Call about the change" : "Review the change";
  if (t.type === "not_helping") return t.hasPhone ? "Call to check in" : "Review the case";
  return "Review";
}

/** One row per case: its most urgent task leads; the other tasks are listed under "Why". */
type CaseRow = { sessionId: string; path: string; tasks: QueueTask[]; top: QueueTask; receivedAt: string; unacked: number; escalated: boolean };
function byCase(tasks: QueueTask[]): CaseRow[] {
  const rows = new Map<string, CaseRow>();
  for (const t of tasks) {
    // Tasks arrive sorted by urgency, then time left, so the first one per case leads.
    const row = rows.get(t.sessionId) ?? { sessionId: t.sessionId, path: t.path, tasks: [], top: t, receivedAt: t.createdAt, unacked: 0, escalated: false };
    row.tasks.push(t);
    if (t.createdAt < row.receivedAt) row.receivedAt = t.createdAt;
    if (!t.acknowledgedAt) row.unacked += 1;
    if (t.escalatedAt) row.escalated = true;
    rows.set(t.sessionId, row);
  }
  return [...rows.values()];
}

/** Arrived in the last minute: the row highlights once so the eye finds it. */
const justNow = (iso: string) => Date.now() - new Date(iso).getTime() < 60_000;

const pathLabel = (p: string) =>
  p === "contact" ? "Call-back only" : p === "followup" ? "Follow-up" : p === "crisis" ? "From the crisis page" : `${p[0].toUpperCase()}${p.slice(1)} check`;

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
  const view = String(params.view ?? "all");
  const notFound = typeof params.notfound === "string" ? params.notfound : null;
  const filter = FILTERS.find((f) => f.id === view) ?? FILTERS[0];
  const cases = byCase(await loadQueue());
  // A filter keeps every case with at least one matching task.
  const shown = cases.filter((c) => c.tasks.some(filter.match));
  const write = canWrite(staff);
  const now = new Date().toISOString();
  const imminent = cases.filter((c) => c.top.priority === "imminent" && c.unacked > 0);
  const stats = [
    { label: "Imminent", value: cases.filter((c) => c.top.priority === "imminent").length, alert: true },
    { label: "Urgent", value: cases.filter((c) => c.top.priority === "urgent").length },
    { label: "Overdue", value: cases.filter((c) => c.tasks.some((t) => t.dueAt < now)).length, alert: true },
    { label: "Not yet acknowledged", value: cases.filter((c) => c.unacked > 0).length },
  ];

  return (
    <StaffShell
      staff={staff}
      active={filter.id === "escalated" ? "escalated" : "queue"}
      counts={{ open: cases.length, escalated: cases.filter((c) => c.escalated).length }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[2rem] leading-tight font-normal">
            Review <em className="text-blue">queue</em>
          </h1>
          <p className="text-[0.8125rem] text-muted">One row per case · most urgent first, then by time left</p>
        </div>
        <AutoRefresh />
      </div>

      {notFound !== null && (
        <p role="status" className="rounded-lg border border-line bg-surface px-4 py-2.5 text-[0.875rem]">
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

      {imminent.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger px-5 py-3.5 text-white">
          <strong className="font-semibold">
            {imminent.length} imminent {imminent.length === 1 ? "case needs" : "cases need"} a response within 15 minutes.
          </strong>
          <Link
            href={`/staff/case/${imminent[0].sessionId}`}
            className="inline-flex min-h-10 items-center rounded-lg bg-white px-4 font-semibold text-danger no-underline hover:text-danger"
          >
            Open {caseRef(imminent[0].sessionId)}
          </Link>
        </div>
      )}

      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line-warm bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col-reverse gap-0.5 border-line-warm px-5 py-3 not-first:border-s max-sm:border-t">
            <dt className="text-[0.75rem] font-medium text-muted">{s.label}</dt>
            <dd className={`text-[1.375rem] leading-tight font-semibold tabular-nums ${s.alert && s.value > 0 ? "text-danger" : "text-ink"}`}>
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      <nav aria-label="Filter the queue" className="-mb-2 flex gap-1 overflow-x-auto border-b border-line">
        {FILTERS.map((f) => {
          const on = f.id === filter.id;
          return (
            <Link
              key={f.id}
              href={f.id === "all" ? "/staff" : `/staff?view=${f.id}`}
              aria-current={on ? "page" : undefined}
              className={`-mb-px inline-flex min-h-10 items-center gap-2 border-b-2 px-3 text-[0.875rem] whitespace-nowrap no-underline ${
                on ? "border-primary font-semibold text-ink hover:text-ink" : "border-transparent font-medium text-muted hover:border-line hover:text-ink"
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 text-[0.75rem] tabular-nums ${on ? "bg-sage text-ink" : "bg-sage-soft text-muted"}`}>
                {cases.filter((c) => c.tasks.some(f.match)).length}
              </span>
            </Link>
          );
        })}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-line-warm bg-surface px-5 py-8 text-center text-text-2 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          {filter.id === "all" ? "No open cases." : `No open cases under "${filter.label}".`}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line-warm bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          <table className="w-full min-w-[940px] border-collapse text-left text-[0.875rem]">
            <thead className="bg-sage-mist text-[0.6875rem] tracking-[0.06em] text-muted uppercase">
              <tr>
                <th scope="col" className="w-32 px-4 py-2.5 font-semibold">Case</th>
                <th scope="col" className="w-28 px-4 py-2.5 font-semibold">Priority</th>
                <th scope="col" className="min-w-48 px-4 py-2.5 font-semibold">Why</th>
                <th scope="col" className="w-52 px-4 py-2.5 font-semibold">Next action</th>
                <th scope="col" className="w-36 px-4 py-2.5 font-semibold">Due</th>
                <th scope="col" className="w-28 px-4 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            {GROUPS.map((group) => {
              const rows = shown.filter((c) => group.tiers.includes(c.top.priority));
              if (rows.length === 0) return null;
              return (
                <tbody key={group.title}>
                  <tr className="border-t border-line-warm">
                    <th scope="colgroup" colSpan={7} className="px-4 pt-4 pb-1.5 text-left">
                      <span className="text-[0.9375rem] font-semibold text-ink">{group.title}</span>
                      <span className="ms-2 text-[0.8125rem] font-normal text-muted">
                        {rows.length} · {group.note}
                      </span>
                    </th>
                  </tr>
                  {rows.map((c) => {
                    const t = c.top;
                    const overdue = c.tasks.some((x) => x.dueAt < now);
                    const edge =
                      t.priority === "imminent" || overdue ? "border-s-danger" : t.priority === "urgent" ? "border-s-[#d9a441]" : "border-s-transparent";
                    return (
                      <tr
                        key={c.sessionId}
                        className={`border-t border-line-warm align-top hover:bg-sage-mist ${c.unacked > 0 ? "bg-surface" : "bg-bg/60"} ${
                          justNow(c.receivedAt) ? "anim-highlight" : ""
                        }`}
                      >
                        <td className={`border-s-4 px-4 py-3 ${edge}`}>
                          <Link href={`/staff/case/${c.sessionId}`} className="font-semibold whitespace-nowrap text-ink tabular-nums">
                            {caseRef(c.sessionId)}
                          </Link>
                          <span className="block text-[0.75rem] whitespace-nowrap text-muted">{pathLabel(c.path)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <PriorityBadge priority={t.priority} />
                        </td>
                        <td className="px-4 py-3">
                          <ul className="flex flex-col gap-0.5">
                            {c.tasks.map((x) => (
                              <li key={x.id} className={`whitespace-nowrap ${x === t ? "font-medium text-ink" : "text-[0.8125rem] text-text-2"}`}>
                                {TASK_LABELS[x.type] ?? x.type}
                                {x.ruleId && <span className="block text-[0.75rem] font-normal text-muted">{x.ruleId}</span>}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-4 py-3 text-text-2">{nextAction(t)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Countdown dueAt={t.dueAt} />
                          <span className="block text-[0.75rem] text-muted">In {received.format(new Date(c.receivedAt))}</span>
                        </td>
                        <td className="px-4 py-3">
                          {c.escalated && <strong className="block font-semibold text-danger">Escalated</strong>}
                          <span className={c.unacked > 0 ? "font-semibold text-ink" : "text-muted"}>{c.unacked > 0 ? "New" : "Acknowledged"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-start justify-end gap-2">
                            {c.unacked > 0 && write && <ActionButton action={acknowledgeCase.bind(null, c.sessionId)}>Acknowledge</ActionButton>}
                            <Link
                              href={`/staff/case/${c.sessionId}`}
                              className="inline-flex min-h-9 items-center rounded-full bg-primary px-3 text-[0.875rem] font-medium text-white no-underline hover:bg-primary-dark hover:text-white"
                            >
                              Open
                            </Link>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </StaffShell>
  );
}
