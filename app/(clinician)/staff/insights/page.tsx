import { Suspense } from "react";
import { ConsoleLoading } from "../console-loading";
import { requireStaff } from "@/lib/staff/auth";
import { loadInsights, type Insights } from "@/lib/staff/insights";
import { loadQueue } from "@/lib/staff/data";
import { PriorityBadge, StaffShell } from "../staff-header";
import { serviceById } from "@/lib/directory";
import { loadOutcomes } from "@/lib/staff/outcomes";
import { cellText, shareText } from "@/lib/outcomes/aggregate";
import { AdverseEventForm } from "../adverse-event-form";
import clinics from "@/content/clinics.json";
import Link from "next/link";

export default function InsightsPage() {
  return (
    <Suspense fallback={<ConsoleLoading kind="insights" />}>
      <InsightsView />
    </Suspense>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const pct = (part: number, whole: number) => (whole === 0 ? "–" : `${Math.round((part / whole) * 100)}%`);
function duration(minutes: number | null): string {
  if (minutes === null) return "–";
  if (minutes < 1) return "under 1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${String(Math.round(minutes % 60)).padStart(2, "0")}m`;
}

function Panel({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-xl border border-line-warm bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <header className="flex min-h-12 flex-wrap items-baseline justify-between gap-2 border-b border-line-warm bg-surface px-5 py-3">
        <h2 id={id} className="text-[0.9375rem] font-semibold">{title}</h2>
        {note && <span className="text-[0.75rem] text-muted">{note}</span>}
      </header>
      <div className="flex flex-col gap-3 px-5 py-4">{children}</div>
    </section>
  );
}

async function InsightsView() {
  const staff = await requireStaff();
  const [data, queue, out] = await Promise.all([loadInsights(), loadQueue(), loadOutcomes()]);
  // Only organisations that real check-ins came from.
  const orgs = clinics.clinics.filter((c) => "kind" in c && c.kind !== "clinic" && (out.orgCounts[c.id] ?? 0) > 0);
  // Outcome tiles: only measures with something entered behind them.
  const tiles = [
    {
      label: "Screen to first contact",
      value: out.screenToFirstContactHours === null ? "" : duration(out.screenToFirstContactHours * 60),
      sub: `median · ${plural(out.screenToFirstContactN, "person", "people")}`,
      has: out.screenToFirstContactN > 0,
      lead: true,
    },
    { label: "Successful hand-off", value: pct(out.handOff.done, out.handOff.of), sub: `${out.handOff.done} of ${out.handOff.of} referred reached the service`, has: out.handOff.of > 0 },
    { label: "Hand-offs stalled", value: String(out.stalled.n), sub: `of ${out.stalled.of} referred · back to the queue`, has: out.stalled.of > 0 },
    { label: "Follow-up on time", value: pct(out.followUpOnTime.done, out.followUpOnTime.of), sub: `${out.followUpOnTime.done} of ${out.followUpOnTime.of} within a week of due`, has: out.followUpOnTime.of > 0 },
    { label: "Waiting time", value: out.waitDays === null ? "" : `${out.waitDays.toFixed(1)} days`, sub: `median referral to booking · ${out.waitN}`, has: out.waitN > 0 },
    { label: "Reliable improvement", value: pct(out.reliableImprovement.done, out.reliableImprovement.of), sub: `${out.reliableImprovement.done} of ${out.reliableImprovement.of} with a follow-up`, has: out.reliableImprovement.of > 0 },
    { label: "Crisis responses completed", value: pct(out.crisis.done, out.crisis.of), sub: `${out.crisis.done} of ${out.crisis.of} urgent alerts on time`, has: out.crisis.of > 0 },
    { label: "Adverse events", value: String(out.adverse.total), sub: plural(out.adverse.severe, "severe", "severe"), has: out.adverse.total > 0 },
  ].filter((t) => t.has);
  // Fairness: only the groups people actually answered ("Not given" alone means nothing was entered).
  const fairness = out.fairness
    .map((f) => ({ ...f, groups: f.groups.filter((g) => g.group !== "Not given") }))
    .filter((f) => f.groups.length > 0);
  const aiUsed = data.safetyChecks + data.aiBlocked + data.aiFallback > 0;
  const decided = data.accepted + data.overridden > 0;
  return (
    <StaffShell staff={staff} active="insights" counts={{ open: queue.length, escalated: queue.filter((t) => t.escalatedAt).length }}>
      <div>
        <h1 className="font-serif text-[2rem] leading-tight font-normal">
          Service <em className="text-blue">insights</em>
        </h1>
        <p className="text-[0.8125rem] text-muted">Last {data.days} days · computed from the app&apos;s own records · times in UAE time</p>
      </div>

      {/* Outcomes (challenge brief): screen-to-first-contact first. */}
      <section aria-labelledby="outcomes-h" className="flex flex-col gap-3">
        <h2 id="outcomes-h" className="text-[1.0625rem] font-semibold">
          Outcomes
        </h2>
        <p className="text-[0.8125rem] text-muted">
          Last {out.days} days · {plural(out.counted, "person", "people")} who agreed to anonymous statistics · groups under {out.minGroup} are
          not shown
        </p>
        {tiles.length === 0 ? (
          <p className="rounded-xl border border-line-warm bg-surface px-5 py-4 text-[0.875rem] text-muted">
            Outcome measures appear here once people who agreed to anonymous statistics are contacted, referred or followed up.
          </p>
        ) : (
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line-warm bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:grid-cols-4">
          {tiles.map((s) => (
            <div
              key={s.label}
              className={`flex flex-col gap-0.5 border-line-warm px-5 py-3 not-first:border-s max-sm:border-t sm:nth-[n+5]:border-t ${s.lead ? "bg-sky" : ""}`}
            >
              <dt className={`text-[0.75rem] font-medium ${s.lead ? "text-blue-ink" : "text-muted"}`}>{s.label}</dt>
              <dd className="text-[1.5rem] leading-tight font-semibold text-ink tabular-nums">{s.value}</dd>
              <dd className="text-[0.75rem] text-muted">{s.sub}</dd>
            </div>
          ))}
        </dl>
        )}

        {fairness.length > 0 && (
        <Panel id="fair-h" title="Fairness" note={`Who reached first contact, by group · groups under ${out.minGroup} not shown`}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {fairness.map((f) => (
              <table key={f.dim} className="w-full border-collapse text-left text-[0.8125rem]">
                <caption className="pb-1 text-left text-[0.75rem] font-semibold tracking-[0.04em] text-muted uppercase">{f.label}</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Group</th>
                    <th scope="col">People</th>
                    <th scope="col">Reached first contact</th>
                  </tr>
                </thead>
                <tbody>
                  {f.groups.length === 0 ? (
                    <tr>
                      <td className="py-1 text-muted">No data</td>
                    </tr>
                  ) : (
                    f.groups.map((g) => (
                      <tr key={g.group} className="border-t border-line-warm">
                        <th scope="row" className="py-1 pe-2 font-medium">{g.group}</th>
                        <td className="py-1 pe-2 text-muted tabular-nums">{cellText(g.count)}</td>
                        <td className="py-1 tabular-nums">{g.count.suppressed ? "–" : shareText(g.reachedContact)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ))}
          </div>
        </Panel>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel id="adverse-h" title="Adverse events" note="Reported by clinicians">
            <p className="text-[0.875rem]">
              {out.adverse.total === 0 ? "None reported in this period." : `${out.adverse.total} reported, ${out.adverse.severe} severe.`}
            </p>
            <AdverseEventForm />
          </Panel>
          {orgs.length > 0 && (
          <Panel id="orgs-h" title="Employer and university views" note={`Aggregates only · minimum group ${out.minGroup}`}>
            <p className="text-[0.875rem] text-text-2">
              Organisations that link to the check-in see totals only, never a person, an answer or a score.
            </p>
            <ul className="flex flex-col gap-1">
              {orgs.map((o) => (
                <li key={o.id}>
                  <Link href={`/staff/org/${o.id}`} className="inline-flex min-h-10 items-center text-[0.875rem] font-semibold">
                    See what {o.name} sees →
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          )}
        </div>
      </section>

      {/* Headline numbers. */}
      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line-warm bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Check-ins started", value: String(data.started), sub: `${data.quick} quick · ${data.full} full${data.followUps ? ` · ${data.followUps} follow-up` : ""}` },
          { label: "Completed", value: pct(data.completed, data.started), sub: `${data.completed} of ${data.started}` },
          { label: "Sent to a clinician", value: String(data.sentToClinician), sub: plural(data.callbacks, "call-back request", "call-back requests") },
          { label: "Red flags raised", value: String(data.flagsTotal), sub: plural(data.takenOver, "chat handed to a person", "chats handed to people") },
          { label: "Median review time", value: data.reviewMedianSeconds === null ? "–" : duration(data.reviewMedianSeconds / 60), sub: plural(data.reviewsSigned, "summary signed", "summaries signed") },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 border-line-warm px-5 py-3 not-first:border-s max-xl:border-t">
            <dt className="text-[0.75rem] font-medium text-muted">{s.label}</dt>
            <dd className="text-[1.5rem] leading-tight font-semibold text-ink tabular-nums">{s.value}</dd>
            <dd className="text-[0.75rem] text-muted">{s.sub}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <Panel id="daily-h" title="Check-ins per day" note="Last 14 days">
          <DailyChart daily={data.daily} />
        </Panel>

        {data.flagsByRule.length > 0 && (
          <Panel id="flags-h" title="Red flags by rule" note="Fixed rules, not AI">
            <RuleBars rows={data.flagsByRule} />
          </Panel>
        )}
      </div>

      <Panel id="resp-h" title="Response times" note="From the task being raised to a clinician acknowledging it">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[0.875rem]">
            <thead className="text-[0.6875rem] tracking-[0.06em] text-muted uppercase">
              <tr>
                {["Tier", "Target", "Raised", "Acknowledged", "Median time", "On time", "Waiting, overdue"].map((h) => (
                  <th key={h} scope="col" className="py-2 pe-4 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.response.filter((r) => r.raised > 0).map((r) => (
                <tr key={r.id} className="border-t border-line-warm">
                  <td className="py-2.5 pe-4"><PriorityBadge priority={r.id === "routine" ? "normal" : r.id} /></td>
                  <td className="py-2.5 pe-4 text-text-2">{r.target}</td>
                  <td className="py-2.5 pe-4 tabular-nums">{r.raised}</td>
                  <td className="py-2.5 pe-4 tabular-nums">{r.acknowledged}</td>
                  <td className="py-2.5 pe-4 font-medium tabular-nums">{duration(r.medianMinutes)}</td>
                  <td className="py-2.5 pe-4 tabular-nums">
                    {r.acknowledged === 0 ? "–" : <><strong className="font-semibold">{pct(r.onTime, r.acknowledged)}</strong> <span className="text-muted">({r.onTime} of {r.acknowledged})</span></>}
                  </td>
                  <td className={`py-2.5 pe-4 tabular-nums ${r.waitingOverdue > 0 ? "font-semibold text-danger" : ""}`}>{r.waitingOverdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {(decided || data.referrals.length > 0) && (
        <Panel id="dec-h" title="Clinician decisions" note="On the proposed care level">
          <dl className="grid grid-cols-3 gap-4">
            {[
              ["Accepted", String(data.accepted)],
              ["Overridden", String(data.overridden)],
              ["Override rate", pct(data.overridden, data.accepted + data.overridden)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[0.75rem] font-medium text-muted">{k}</dt>
                <dd className="text-[1.375rem] leading-tight font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[0.8125rem] text-muted">Every override needs a reason, which is logged on the case.</p>
          {data.referrals.length > 0 && (
          <div className="border-t border-line-warm pt-3">
            <p className="text-[0.75rem] font-medium text-muted">Referrals by service</p>
            {data.referrals.length === 0 ? null : (
              <ul className="mt-1 flex flex-col gap-1 text-[0.875rem]">
                {data.referrals.map(([id, n]) => (
                  <li key={id} className="flex justify-between gap-3">
                    <span>{serviceById(id)?.name ?? id}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}
        </Panel>

        )}

        {aiUsed && (
        <Panel id="ai-h" title="AI safety" note="Full check-in chat">
          <dl className="grid grid-cols-3 gap-4">
            {[
              ["Safety checks asked", String(data.safetyChecks)],
              ["AI replies blocked", String(data.aiBlocked)],
              ["Fell back to questions", String(data.aiFallback)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[0.75rem] font-medium text-muted">{k}</dt>
                <dd className="text-[1.375rem] leading-tight font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[0.8125rem] text-muted">
            Blocked means a guardrail stopped an AI reply before the person saw it. Fell back means the AI was unavailable and the
            person got the questionnaire instead.
          </p>
        </Panel>
        )}
      </div>
    </StaffShell>
  );
}

/** One series, so no legend: the panel title names it. Hover a bar for its value; screen readers get the table below. */
function DailyChart({ daily }: { daily: Insights["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.value));
  const top = Math.max(4, Math.ceil(max / 4) * 4);
  return (
    <figure className="flex flex-col gap-2">
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        <div aria-hidden="true" className="flex h-40 flex-col justify-between text-end text-[0.6875rem] text-muted tabular-nums">
          <span>{top}</span>
          <span>{top / 2}</span>
          <span>0</span>
        </div>
        <div aria-hidden="true" className="relative h-40 border-b border-line">
          <div className="absolute inset-x-0 top-0 border-t border-line-warm" />
          <div className="absolute inset-x-0 top-1/2 border-t border-line-warm" />
          <div className="relative flex h-full items-end gap-0.5">
            {daily.map((d) => (
              <div key={d.label} className="group relative flex h-full flex-1 items-end justify-center">
                <div
                  className="w-full max-w-7 rounded-t-[4px] bg-primary group-hover:bg-primary-dark"
                  style={{ height: d.value === 0 ? 0 : `${(d.value / top) * 100}%` }}
                />
                <span className="pointer-events-none absolute top-1 z-10 hidden rounded-md bg-ink px-2 py-1 text-[0.75rem] whitespace-nowrap text-white group-hover:block">
                  {d.label}: {d.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        <span />
        <div aria-hidden="true" className="flex gap-0.5 pt-1 text-[0.6875rem] text-muted">
          {daily.map((d, i) => (
            <span key={d.label} className="flex-1 text-center whitespace-nowrap">{i % 3 === 0 || i === daily.length - 1 ? d.label : ""}</span>
          ))}
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>Check-ins per day</caption>
          <tbody>
            {daily.map((d) => (
              <tr key={d.label}><th scope="row">{d.label}</th><td>{d.value}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function RuleBars({ rows }: { rows: Insights["flagsByRule"] }) {
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.slice(0, 8).map((r) => (
        <li key={r.rule} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[0.8125rem]">
          <span className="truncate font-medium" title={`${r.rule} (${r.tier})`}>{r.rule}</span>
          <span aria-hidden="true" className="h-2.5 rounded-e-[4px] bg-primary" style={{ width: `${(r.n / max) * 100}%` }} />
          <span className="tabular-nums">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}
