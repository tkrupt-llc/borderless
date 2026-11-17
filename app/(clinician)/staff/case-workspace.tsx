import Link from "next/link";
import { loadCase, loadCaseTrend } from "@/lib/staff/data";
import { loadRuleFile } from "@/lib/rules/load";
import { caseRef } from "@/lib/case-ref";
import { clinicById } from "@/lib/clinics";
import { bankItem } from "@/lib/item-bank";
import { summaryToText } from "@/lib/summary/build";
import { ACTIVITY_WORDS, actorWord } from "@/lib/staff/activity-words";
import { seriesFrom, TrendChart } from "@/components/trend-chart";
import { TASK_LABELS } from "./staff-header";
import { TimeLeft } from "./ui";
import { ActionBar } from "./action-bar";

// The selected case in the review workspace (design canvas: queue → case → act).

const LEVEL: Record<string, { label: string; chip: string }> = {
  imminent: { label: "Imminent", chip: "bg-danger text-white" },
  urgent: { label: "Urgent", chip: "bg-[#f4e3d3] text-[#6b3e1c]" },
  elevated: { label: "Elevated", chip: "bg-[#e9e4f5] text-[#463c6e]" },
  normal: { label: "Routine", chip: "bg-[#edf0f1] text-[#34505b]" },
};
const SCORE: Record<string, { name: string; max: number }> = {
  PHQ9: { name: "PHQ-9", max: 27 },
  GAD7: { name: "GAD-7", max: 21 },
  PHQ2: { name: "PHQ-2", max: 6 },
  GAD2: { name: "GAD-2", max: 6 },
  ASQ: { name: "ASQ (yes answers)", max: 4 },
};
const BAND: Record<string, string> = {
  minimal: "Minimal", mild: "Mild", moderate: "Moderate", moderately_severe: "Moderately severe", severe: "Severe",
  positive: "Positive", negative: "Negative", non_acute_positive: "Positive, not acute", acute_positive: "Acute positive",
};
const pathLabel = (p: string) =>
  p === "contact" ? "Call-back only" : p === "followup" ? "Follow-up" : p === "crisis" ? "Crisis page" : `${p[0].toUpperCase()}${p.slice(1)} check-in`;
const clock = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const card = "rounded-[14px] border border-line-warm bg-surface p-4";
const label = "text-[0.75rem] font-semibold tracking-[0.04em] text-muted uppercase";

export async function CaseWorkspace({
  sessionId,
  priority,
  tab,
  write,
  baseHref,
  nextHref,
}: {
  sessionId: string;
  priority: string;
  tab: string;
  write: boolean;
  baseHref: string;
  nextHref: string;
}) {
  const [data, chain] = await Promise.all([loadCase(sessionId), loadCaseTrend(sessionId)]);
  if (!data) return null;
  const { session, proposal, decision, summary } = data;
  const level = LEVEL[priority] ?? LEVEL.normal;
  const openTasks = data.tasks.filter((t) => !t.closed_at);
  const lead = openTasks.find((t) => t.priority === priority) ?? openTasks[0];
  const changed = data.activity.some((a) => a.action === "urgency_changed");
  const clinic = clinicById(session.clinic_id);

  // Why it's here: the rule that fired (from the rules file), else the routing reasons, else the request.
  const ruleText = new Map(loadRuleFile("red-flags").rules.map((r) => [r.id, r.description]));
  const why =
    data.redFlags.length > 0
      ? data.redFlags.map((r) => ruleText.get(r.rule_id) ?? r.trigger).join(" · ")
      : lead?.type === "talk_to_person" || lead?.type === "callback"
        ? "Asked the care team to call back."
        : lead?.type === "not_helping"
          ? "Said a coping card wasn't helping."
          : lead?.type === "not_on_track"
            ? "Scores got reliably worse since the last check-in (follow-up rule)."
            : proposal
              ? proposal.reasons.join("; ")
              : "Check-in to review.";
  const ruleIds = data.redFlags.length > 0 ? data.redFlags.map((r) => r.rule_id).join(", ") : proposal?.rule_ids.join(", ");

  const trendSeries = chain && chain.sessions.length > 1 ? seriesFrom(chain.points)[0] : null;
  const trendDelta = trendSeries && trendSeries.points.length > 1 ? trendSeries.points.at(-1)!.total - trendSeries.points[0].total : 0;
  const badges = [
    data.redFlags.length > 0 && { label: "Safety", cls: "border border-[#f0cfcc] bg-[#fbedec] text-[#8a2a25]" },
    (openTasks.some((t) => t.type === "not_on_track") || trendDelta > 0) && { label: "Worsening", cls: "border border-[#eed9c4] bg-[#fbf3ec] text-[#6b3e1c]" },
    trendDelta < 0 && { label: "Improving", cls: "border border-[#d3e0c6] bg-[#eaf2e3] text-[#2c3825]" },
  ].filter(Boolean) as { label: string; cls: string }[];

  const signed = Boolean(summary?.signed_at);
  const note = summary?.edited?.text ?? summaryToText(data.draftLines);
  const words = data.messages.find((m) => m.role === "patient")?.text ?? data.redFlags.find((r) => r.quote)?.quote ?? null;

  // The case's real workflow, in order (not a clinical protocol).
  const steps = [
    { text: "Acknowledge the case", done: data.tasks.every((t) => t.acknowledged_at || t.closed_at) },
    { text: proposal?.urgent ? "Accept or change the urgent pathway" : "Accept or change the proposed care level", done: Boolean(decision) || !proposal },
    { text: "Check and sign the summary", done: signed },
    ...(session.contact_phone ? [{ text: "Call the patient and log the call", done: data.contacts.some((c) => c.outcome === "spoke") }] : []),
  ];
  const followUp = data.consents.follow_up === true;
  const tabs = [
    ["summary", "Summary"],
    ["answers", "Answers"],
    ["history", "History"],
  ] as const;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-warm bg-surface px-6 pt-[18px] pb-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[1.25rem] font-semibold tabular-nums">{caseRef(sessionId)}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold ${level.chip}`}>{level.label}</span>
            {changed && <span className="text-[0.75rem] text-muted">urgency changed by a clinician</span>}
          </div>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {pathLabel(session.path)}
            {clinic && ` via ${clinic.name}`} · received {when(session.created_at)}
            {lead && ` · reply by ${clock(lead.due_at)}`}
          </p>
          <Link href={`/staff/case/${sessionId}`} className="mt-1 inline-flex min-h-8 items-center text-[0.8125rem] font-semibold">
            Open full case →
          </Link>
        </div>
        {lead && (
          <div className={`rounded-[10px] px-3 py-2 text-right text-[1.125rem] font-bold ${priority === "imminent" ? "bg-danger text-white" : "bg-sage-soft text-text-on-sage"}`}>
            <span className="block text-[0.6875rem] font-medium opacity-85">Time left</span>
            <TimeLeft dueAt={lead.due_at} />
          </div>
        )}
      </div>

      <nav aria-label="Case sections" className="flex gap-1 border-b border-line-warm bg-surface px-6">
        {tabs.map(([id, name]) => {
          const on = tab === id;
          return (
            <Link
              key={id}
              href={`${baseHref}${baseHref.includes("?") ? "&" : "?"}tab=${id}`}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-10 items-center px-3 text-[0.875rem] no-underline ${
                on ? "font-semibold text-text-on-sage shadow-[inset_0_-2px_0_var(--primary)] hover:text-text-on-sage" : "font-medium text-muted hover:text-ink"
              }`}
            >
              {name}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 flex-col gap-4 px-6 pt-5 pb-8">
        {tab === "summary" && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {badges.length ? (
                badges.map((b) => (
                  <span key={b.label} className={`rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold ${b.cls}`}>
                    {b.label}
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-line-warm bg-sage-mist px-2.5 py-0.5 text-[0.75rem] text-muted">No risk flags</span>
              )}
            </div>

            <section className={card} aria-label="Why it's in your queue">
              <span className={label}>Why it&apos;s in your queue</span>
              <p className="mt-1.5 text-[0.9375rem]">{why}</p>
              <p className="mt-1.5 text-[0.75rem] text-muted">
                {lead ? `${TASK_LABELS[lead.type] ?? lead.type}` : "Review"}
                {ruleIds && ` · rule ${ruleIds}`} · fixed rules, not AI
              </p>
            </section>

            <section className={card} aria-label="Steps for this case">
              <span className={label}>Steps for this case</span>
              <ul className="mt-2 flex flex-col gap-1">
                {steps.map((st) => (
                  <li key={st.text} className={`flex min-h-9 items-center gap-2.5 text-[0.875rem] ${st.done ? "text-muted line-through" : "text-ink"}`}>
                    <span
                      aria-hidden="true"
                      className={`grid size-5 shrink-0 place-items-center rounded-md text-[0.75rem] font-bold ${
                        st.done ? "border-[1.5px] border-primary bg-primary text-white" : "border-[1.5px] border-[#8fa7b0] bg-surface"
                      }`}
                    >
                      {st.done ? "✓" : ""}
                    </span>
                    {st.text}
                    <span className="sr-only">{st.done ? " (done)" : " (to do)"}</span>
                  </li>
                ))}
              </ul>
            </section>

            {data.scores.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {data.scores.map((sc) => {
                  const meta = SCORE[sc.instrument] ?? { name: sc.instrument, max: 27 };
                  return (
                    <div key={sc.instrument} className="rounded-[14px] border border-line-warm bg-surface p-3.5">
                      <span className="text-[0.75rem] text-muted">{meta.name}</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif text-[1.875rem] leading-tight">{sc.total}</span>
                        <span className="text-muted">/ {meta.max}</span>
                        <span className="ms-auto text-[0.75rem] font-semibold text-text-2">{BAND[sc.band] ?? sc.band}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-[#e3ebee]">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((sc.total / meta.max) * 100))}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {trendSeries && (
              <div className="rounded-[14px] border border-line-warm bg-surface px-4 py-3.5">
                <TrendChart series={trendSeries} color="var(--primary)" />
              </div>
            )}

            {words && (
              <section className={card} aria-label="In their words">
                <span className={label}>In their words</span>
                <p className="mt-1.5 text-[0.9375rem]">&ldquo;{words.length > 300 ? `${words.slice(0, 300)}…` : words}&rdquo;</p>
              </section>
            )}

            {note && (
              <section className={`rounded-[14px] p-4 ${signed ? "bg-sage-soft" : "bg-ai-soft"}`} aria-label="Summary note">
                <span className={`text-[0.75rem] font-semibold tracking-[0.04em] uppercase ${signed ? "text-brand" : "text-ai-ink"}`}>
                  {signed ? "Summary · clinician-verified" : "AI-drafted note · check against answers"}
                </span>
                <p className="mt-1.5 line-clamp-6 whitespace-pre-line">{note}</p>
              </section>
            )}

            <p className="text-[0.75rem] text-muted">
              {followUp ? "The patient chose a follow-up check-in in about 4 weeks." : "No follow-up check-in chosen."}
            </p>
          </>
        )}

        {tab === "answers" && (
          <div className="overflow-hidden rounded-[14px] border border-line-warm bg-surface">
            {data.answers.length === 0 ? (
              <p className="px-4 py-3 text-muted">No questionnaire answers.</p>
            ) : (
              data.answers.map((a, i) => {
                const item = bankItem(a.item_id);
                const answer = item?.options.find((o) => o.value === a.value)?.label.en ?? String(a.value);
                const risky = a.value > 0 && /^(PHQ9-9|QC_SUICIDE|ASQ|CSSRS_SCREENER|RED_FLAG)/.test(a.item_id);
                return (
                  <div key={a.item_id} className={`flex gap-3 px-4 py-3 ${i ? "border-t border-[#eef2f4]" : ""} ${risky ? "bg-[#fbedec]" : ""}`}>
                    <span className="flex-1">
                      <span className="block text-[0.75rem] text-muted">{a.item_id}</span>
                      {item?.text.en}
                    </span>
                    <strong className="font-semibold whitespace-nowrap">{answer}</strong>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "history" && (
          <>
            <ol className="flex flex-col">
              {data.activity
                .filter((a) => a.action !== "case_viewed")
                .map((a, i) => (
                  <li key={a.created_at + a.action + i} className="flex gap-3 border-b border-line-warm py-2.5">
                    <span className="w-28 shrink-0 text-[0.75rem] text-muted tabular-nums">{when(a.created_at)}</span>
                    <span>
                      {ACTIVITY_WORDS[a.action] ?? a.action.replaceAll("_", " ")}
                      <span className="text-muted"> · {actorWord(a.actor)}</span>
                    </span>
                  </li>
                ))}
            </ol>
            <p className="text-[0.75rem] text-muted">Every change is logged with who and when. Entries can&apos;t be edited.</p>
          </>
        )}
      </div>

      <ActionBar
        key={sessionId}
        sessionId={sessionId}
        refLabel={caseRef(sessionId)}
        write={write}
        phone={session.contact_phone}
        priority={priority}
        nextHref={nextHref}
      />
    </div>
  );
}
