import { Suspense } from "react";
import Link from "next/link";
import { canWrite, requireStaff } from "@/lib/staff/auth";
import { loadQueue } from "@/lib/staff/data";
import { acknowledgeTask } from "./actions";
import { PriorityBadge, StaffHeader, TASK_LABELS } from "./staff-header";
import { ActionButton, AutoRefresh, Countdown } from "./ui";

const received = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// The queue: a triage table sorted by tier, then time left (research: a table,
// not tiles). Only imminent cases interrupt, with a banner at the top.
export default function QueuePage({ searchParams }: PageProps<"/staff">) {
  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-5 py-6 text-base sm:px-8">
      <Suspense fallback={<p className="text-muted">Loading the queue…</p>}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Queue({ searchParams }: { searchParams: PageProps<"/staff">["searchParams"] }) {
  const staff = await requireStaff();
  const escalatedOnly = (await searchParams).view === "escalated";
  const all = await loadQueue();
  const tasks = escalatedOnly ? all.filter((t) => t.escalatedAt) : all;
  const imminent = all.filter((t) => t.priority === "imminent" && !t.acknowledgedAt);
  const write = canWrite(staff);

  return (
    <>
      <AutoRefresh />
      <StaffHeader staff={staff} />

      {imminent.length > 0 && (
        <div role="alert" className="rounded-2xl bg-danger px-5 py-4 text-white">
          <strong className="font-semibold">
            {imminent.length} imminent {imminent.length === 1 ? "case needs" : "cases need"} a response within 15 minutes.
          </strong>{" "}
          <Link href={`/staff/case/${imminent[0].sessionId}`} className="text-white underline hover:text-white">
            Open the first one
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          {escalatedOnly ? "Escalated cases" : "Queue"}
        </h1>
        <p className="text-caption text-muted">
          {tasks.length} open · {all.filter((t) => t.escalatedAt).length} escalated · updates every 5 seconds
        </p>
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-2xl bg-surface px-5 py-6 text-text-2">
          {escalatedOnly ? "No escalated cases." : "No open cases."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-left text-caption">
            <thead className="border-b border-line text-muted">
              <tr>
                {["Priority", "Why", "Path", "Received", "Time left", "Status", ""].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-semibold">
                    {h || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-line-warm last:border-0">
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">{TASK_LABELS[t.type] ?? t.type}</span>
                    {t.ruleId && <span className="block text-small text-muted">{t.ruleId}</span>}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {t.path}
                    {t.hasPhone && <span className="block text-small text-muted normal-case">Phone shared</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{received.format(new Date(t.createdAt))}</td>
                  <td className="px-4 py-3">
                    <Countdown dueAt={t.dueAt} />
                  </td>
                  <td className="px-4 py-3">
                    {t.escalatedAt && <strong className="block font-semibold text-danger">Escalated to supervisor</strong>}
                    <span className="block">{t.acknowledgedAt ? "Acknowledged" : "New"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap items-start justify-end gap-2">
                      {!t.acknowledgedAt && write && (
                        <ActionButton action={acknowledgeTask.bind(null, t.id)}>Acknowledge</ActionButton>
                      )}
                      <Link
                        href={`/staff/case/${t.sessionId}`}
                        className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 font-medium text-white no-underline hover:text-white"
                      >
                        Open
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
