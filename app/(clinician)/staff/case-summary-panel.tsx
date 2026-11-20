import Link from "next/link";
import { loadCase, loadCaseTrend } from "@/lib/staff/data";
import type { Scope } from "@/lib/staff/scope";
import { caseRef } from "@/lib/case-ref";
import { clinicById } from "@/lib/clinics";
import { summaryToText } from "@/lib/summary/build";
import { seriesFrom, TrendChart } from "@/components/trend-chart";
import { escalateCase } from "./actions";
import { PriorityBadge, TASK_LABELS } from "./staff-header";
import { ActionButton } from "./ui";

const BAND: Record<string, string> = {
  minimal: "minimal", mild: "mild", moderate: "moderate", moderately_severe: "moderately severe", severe: "severe",
  positive: "positive screen", negative: "negative screen", non_acute_positive: "positive, not acute", acute_positive: "acute positive",
};
const LABEL: Record<string, string> = { PHQ9: "PHQ-9", GAD7: "GAD-7", PHQ2: "PHQ-2", GAD2: "GAD-2", ASQ: "ASQ" };
const pathLabel = (p: string) =>
  p === "contact" ? "Call-back only" : p === "followup" ? "Follow-up" : p === "crisis" ? "From the crisis page" : `${p[0].toUpperCase()}${p.slice(1)} check-in`;

/**
 * The selected case at a glance, beside the queue (DESIGN v2, mockup 08): their
 * own words, scores, the rule that fired, the AI-drafted note (lavender), the
 * trend, and the next actions. The full case page is one click away.
 */
export async function CaseSummaryPanel({
  sessionId,
  priority,
  write,
  scope,
}: {
  sessionId: string;
  priority: string;
  write: boolean;
  scope: Scope;
}) {
  const [data, chain] = await Promise.all([loadCase(sessionId, scope), loadCaseTrend(sessionId, scope)]);
  if (!data) return null;
  const { session, proposal, summary } = data;
  const words = data.messages.find((m) => m.role === "patient")?.text ?? data.redFlags.find((r) => r.quote)?.quote ?? null;
  const signed = Boolean(summary?.signed_at);
  const note = summary?.edited?.text ?? summaryToText(data.draftLines);
  const trend = chain && chain.sessions.length > 1 ? seriesFrom(chain.points)[0] : null;
  const escalated = data.tasks.some((t) => !t.closed_at && t.escalated_at);
  const clinic = clinicById(session.clinic_id);
  const openRequest = data.tasks.find((t) => !t.closed_at && t.type !== "red_flag" && t.type !== "care_request");
  const row = "flex flex-col gap-0.5 border-b border-line-warm py-2.5";
  const key = "text-[0.8125rem] text-muted";

  return (
    <section aria-labelledby="summary-panel-h" className="flex flex-col rounded-2xl border border-line-warm bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h2 id="summary-panel-h" className="text-[1.0625rem] font-semibold">
          {caseRef(sessionId)} · {pathLabel(session.path)}
        </h2>
        <PriorityBadge priority={priority} />
      </div>
      {clinic && <p className="text-[0.8125rem] text-blue">via {clinic.name}</p>}

      <div className={row}>
        <span className={key}>In their words</span>
        <span>{words ? <>&ldquo;{words.length > 220 ? `${words.slice(0, 220)}…` : words}&rdquo;</> : <span className="text-muted">No chat: questionnaire only.</span>}</span>
      </div>
      <div className={row}>
        <span className={key}>Scores</span>
        <span>
          {data.scores.length === 0 ? (
            <span className="text-muted">No questionnaire completed.</span>
          ) : (
            data.scores.map((s, i) => (
              <span key={s.instrument}>
                {i > 0 && " · "}
                {LABEL[s.instrument] ?? s.instrument} <strong className="font-semibold">{s.total}</strong> ({BAND[s.band] ?? s.band.replaceAll("_", " ")})
              </span>
            ))
          )}
        </span>
      </div>
      <div className={row}>
        <span className={key}>Rule that fired</span>
        {data.redFlags.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {data.redFlags.map((r) => (
              <li key={r.rule_id}>
                <strong className="font-semibold">{r.rule_id}</strong> <span className="text-text-2">({r.trigger})</span>
              </li>
            ))}
          </ul>
        ) : proposal && proposal.reasons.length > 0 ? (
          // Routine and elevated: the routing rule IDs with their reasons, as on the full case.
          <ul className="flex flex-col gap-0.5">
            {proposal.reasons.map((reason, i) => (
              <li key={proposal.rule_ids[i] ?? i}>
                {proposal.rule_ids[i] && <strong className="font-semibold">{proposal.rule_ids[i]}</strong>}{" "}
                <span className="text-text-2">({reason})</span>
              </li>
            ))}
          </ul>
        ) : openRequest ? (
          // No rule: the person asked (a call back, a message, a coping card that isn't helping).
          <span>
            No rule: the person asked · <strong className="font-semibold">{TASK_LABELS[openRequest.type] ?? openRequest.type}</strong>
          </span>
        ) : (
          <span className="text-muted">No rule fired.</span>
        )}
      </div>

      {note && (
        <div className={`mt-2.5 rounded-xl px-3.5 py-3 ${signed ? "bg-sage-soft" : "bg-ai-soft"}`}>
          <span className={`block text-[0.8125rem] font-semibold ${signed ? "text-brand" : "text-ai-ink"}`}>
            {signed ? "Summary · clinician-verified" : "AI-drafted note · check against answers"}
          </span>
          <p className="line-clamp-4 text-[0.875rem] whitespace-pre-line">{note}</p>
        </div>
      )}

      {trend && (
        <div className="mt-2.5 rounded-xl bg-sage-soft px-3.5 py-3">
          <TrendChart series={trend} color="var(--blue)" />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {session.contact_phone ? (
          <a
            href={`tel:${session.contact_phone.replace(/[^\d+]/g, "")}`}
            className="tap inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-[0.875rem] font-semibold text-white no-underline hover:text-white"
          >
            Call patient
          </a>
        ) : (
          <span className="inline-flex min-h-10 items-center rounded-full bg-sage-soft px-4 text-[0.875rem] text-muted">No phone shared</span>
        )}
        <Link
          href={`/staff/case/${sessionId}`}
          className="tap inline-flex min-h-10 items-center rounded-full border-[1.5px] border-primary px-4 text-[0.875rem] font-semibold text-primary no-underline hover:text-primary"
        >
          Assign next step
        </Link>
        {write && !escalated && <ActionButton action={escalateCase.bind(null, sessionId)}>Escalate</ActionButton>}
        {escalated && <span className="inline-flex min-h-10 items-center text-[0.875rem] font-semibold text-danger">Escalated to supervisor</span>}
      </div>
    </section>
  );
}
