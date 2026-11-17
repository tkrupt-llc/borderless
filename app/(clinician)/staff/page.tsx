import { Suspense } from "react";
import Link from "next/link";
import { canWrite, requireStaff } from "@/lib/staff/auth";
import { loadQueue, type QueueTask } from "@/lib/staff/data";
import { caseRef } from "@/lib/case-ref";
import { acknowledgeTask } from "./actions";
import { PriorityBadge, StaffShell, TASK_LABELS } from "./staff-header";
import { ActionButton, AutoRefresh, Countdown } from "./ui";

const received = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// The queue is a scanning tool (research): grouped by urgency, each row says
// which case, why, and what to do next; the detail is one click away.
const GROUPS = [
  { tiers: ["imminent"], title: "Act now", note: "Respond within 15 minutes" },
  { tiers: ["urgent"], title: "Act today", note: "Respond within 4 hours" },
  { tiers: ["elevated", "normal"], title: "Routine", note: "Respond within one working day" },
];
const FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "flags", label: "Red flags", match: (t: QueueTask) => t.type === "red_flag" },
  { id: "reviews", label: "Check-ins", match: (t: QueueTask) => t.type === "care_request" },
  { id: "calls", label: "Call-backs", match: (t: QueueTask) => t.type === "talk_to_person" || t.type === "callback" || t.type === "not_helping" },
  { id: "escalated", label: "Escalated", match: (t: QueueTask) => Boolean(t.escalatedAt) },
];

function nextAction(t: QueueTask): string {
  if (t.type === "red_flag") return t.hasPhone ? "Call the patient" : "Review now (no phone shared)";
  if (t.type === "talk_to_person" || t.type === "callback") return "Call back";
  if (t.type === "care_request") return "Review and choose the next step";
  if (t.type === "not_helping") return t.hasPhone ? "Call to check in" : "Review the case";
  return "Review";
}

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
  const all = await loadQueue();
  const tasks = all.filter(filter.match);
  const write = canWrite(staff);
  const now = new Date().toISOString();
  const imminent = all.filter((t) => t.priority === "imminent" && !t.acknowledgedAt);
  const stats = [
    { label: "Imminent", value: all.filter((t) => t.priority === "imminent").length, alert: true },
    { label: "Urgent", value: all.filter((t) => t.priority === "urgent").length },
    { label: "Routine", value: all.filter((t) => t.priority === "normal" || t.priority === "elevated").length },
    { label: "Overdue", value: all.filter((t) => t.dueAt < now).length, alert: true },
    { label: "Not yet acknowledged", value: all.filter((t) => !t.acknowledgedAt).length },
  ];

  return (
    <StaffShell
      staff={staff}
      active={filter.id === "escalated" ? "escalated" : "queue"}
      counts={{ open: all.length, escalated: all.filter((t) => t.escalatedAt).length }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] leading-tight font-semibold tracking-[-0.01em]">Queue</h1>
          <p className="text-[0.8125rem] text-muted">Open cases, most urgent first, then by time left</p>
        </div>
        <AutoRefresh />
      </div>

      {notFound !== null && (
        <p role="status" className="rounded-lg border border-line bg-surface px-4 py-2.5 text-[0.875rem]">
          {notFound ? <>No case found for <strong className="font-semibold">{notFound}</strong>.</> : "Type a case reference to search."}{" "}
          References look like BL-AF09B5.
        </p>
      )}

      {imminent.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger px-5 py-3.5 text-white">
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

      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line-warm bg-surface sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col-reverse gap-0.5 border-line-warm px-5 py-3 not-first:border-s max-xl:border-t">
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
                {all.filter(f.match).length}
              </span>
            </Link>
          );
        })}
      </nav>

      {tasks.length === 0 ? (
        <p className="rounded-lg border border-line-warm bg-surface px-5 py-8 text-center text-text-2">
          {filter.id === "all" ? "No open cases." : `No open cases under "${filter.label}".`}
        </p>
      ) : (
        GROUPS.map((group) => {
          const rows = tasks.filter((t) => group.tiers.includes(t.priority));
          if (rows.length === 0) return null;
          return (
            <section key={group.title} aria-labelledby={`g-${group.tiers[0]}`} className="flex flex-col gap-2">
              <h2 id={`g-${group.tiers[0]}`} className="flex flex-wrap items-baseline gap-x-3 text-[1rem] font-semibold">
                {group.title}
                <span className="text-[0.8125rem] font-normal text-muted">
                  {rows.length} · {group.note}
                </span>
              </h2>
              <div className="overflow-x-auto rounded-lg border border-line-warm bg-surface">
                <table className="w-full min-w-[860px] border-collapse text-left text-[0.875rem]">
                  <thead className="bg-sage-mist text-[0.6875rem] tracking-[0.06em] text-muted uppercase">
                    <tr>
                      {["Case", "Tier", "Reason", "Next action", "Received", "Clock", "Status", ""].map((h) => (
                        <th key={h} scope="col" className="px-4 py-2 font-semibold">
                          {h || <span className="sr-only">Actions</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => {
                      const overdue = t.dueAt < now;
                      const edge = t.priority === "imminent" || overdue ? "border-s-danger" : t.priority === "urgent" ? "border-s-[#d9a441]" : "border-s-transparent";
                      return (
                        <tr key={t.id} className={`border-t border-line-warm hover:bg-sage-mist ${!t.acknowledgedAt ? "bg-surface" : "bg-bg/60"}`}>
                          <td className={`border-s-4 px-4 py-2.5 ${edge}`}>
                            <Link href={`/staff/case/${t.sessionId}`} className="font-semibold whitespace-nowrap text-ink tabular-nums">
                              {caseRef(t.sessionId)}
                            </Link>
                            <span className="block text-[0.75rem] whitespace-nowrap text-muted">{t.path === "contact" ? "No check-in" : `${t.path[0].toUpperCase()}${t.path.slice(1)} check`}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <PriorityBadge priority={t.priority} />
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-ink">{TASK_LABELS[t.type] ?? t.type}</span>
                            {t.ruleId && <span className="block text-[0.75rem] whitespace-nowrap text-muted">{t.ruleId}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-text-2">{nextAction(t)}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-text-2">{received.format(new Date(t.createdAt))}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <Countdown dueAt={t.dueAt} />
                          </td>
                          <td className="px-4 py-2.5">
                            {t.escalatedAt && <strong className="block font-semibold text-danger">Escalated</strong>}
                            <span className={t.acknowledgedAt ? "text-muted" : "font-semibold text-ink"}>
                              {t.acknowledgedAt ? "Acknowledged" : "New"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="flex items-start justify-end gap-2">
                              {!t.acknowledgedAt && write && (
                                <ActionButton action={acknowledgeTask.bind(null, t.id)}>Acknowledge</ActionButton>
                              )}
                              <Link
                                href={`/staff/case/${t.sessionId}`}
                                className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-[0.875rem] font-medium text-white no-underline hover:bg-primary-dark hover:text-white"
                              >
                                Open
                              </Link>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </StaffShell>
  );
}
