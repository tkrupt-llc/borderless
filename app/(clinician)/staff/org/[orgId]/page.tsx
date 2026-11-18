import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff/auth";
import { clinicById } from "@/lib/clinics";
import { loadOrgReport } from "@/lib/staff/outcomes";
import { cellText, MIN_GROUP, shareText } from "@/lib/outcomes/aggregate";
import { StaffShell } from "../../staff-header";

// What an employer or university sees: aggregates only, minimum group size 10.
// Built only from lib/outcomes/aggregate.ts, which never returns a session id,
// an answer or a score.
export default function OrgReportPage({ params }: { params: Promise<{ orgId: string }> }) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <OrgReport params={params} />
    </Suspense>
  );
}

async function OrgReport({ params }: { params: Promise<{ orgId: string }> }) {
  const staff = await requireStaff();
  const { orgId } = await params;
  const org = clinicById(orgId);
  if (!org || org.kind === "clinic") notFound();
  const report = await loadOrgReport(org.id);

  return (
    <StaffShell staff={staff} active="insights">
      <div>
        <h1 className="font-serif text-[2rem] leading-tight font-normal">
          {org.name} <em className="text-blue">view</em>
        </h1>
        <p className="text-[0.8125rem] text-muted">
          What a {org.kind} sees · last {report.days} days · aggregates only, groups under {MIN_GROUP} not shown · synthetic demo data
        </p>
      </div>

      <section aria-labelledby="org-h" className="flex flex-col gap-4 rounded-xl border border-line-warm bg-surface px-5 py-4">
        <h2 id="org-h" className="sr-only">
          Totals
        </h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-[0.75rem] font-medium text-muted">Check-ins started from their page</dt>
            <dd className="text-[1.5rem] font-semibold tabular-nums">{cellText(report.total)}</dd>
          </div>
          <div>
            <dt className="text-[0.75rem] font-medium text-muted">Referred to a support service</dt>
            <dd className="text-[1.5rem] font-semibold tabular-nums">{shareText(report.referredShare)}</dd>
          </div>
        </dl>
        {report.total.suppressed ? (
          <p className="text-[0.875rem] text-text-2">
            Fewer than {MIN_GROUP} people used the check-in from this page in the period, so nothing else is shown.
          </p>
        ) : (
          <table className="w-full max-w-md border-collapse text-left text-[0.875rem]">
            <caption className="pb-1 text-left text-[0.75rem] font-semibold tracking-[0.04em] text-muted uppercase">By type</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Count</th>
              </tr>
            </thead>
            <tbody>
              {report.byPath.map((g) => (
                <tr key={g.group} className="border-t border-line-warm">
                  <th scope="row" className="py-1.5 pe-3 font-medium">{g.group}</th>
                  <td className="py-1.5 tabular-nums">{cellText(g.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[0.8125rem] text-muted">
          Never shown to an employer or university: names, answers, scores, risk flags, or anything about one person.
        </p>
      </section>
    </StaffShell>
  );
}
