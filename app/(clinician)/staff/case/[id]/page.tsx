import { Suspense } from "react";
import { ConsoleLoading } from "../../console-loading";
import { ReplyBox } from "../../reply-box";
import { headers } from "next/headers";
import { CloseCaseForm } from "../../close-case-form";
import { FollowUpLinkPanel } from "../../follow-up-link-panel";
import { CLOSURE_REASONS } from "@/lib/staff/safety-rules";
import { closureStateFrom } from "@/lib/staff/closure";
import { DiscreetMessage, SendNewReturnCode } from "../../discreet-message";
import { CloseRedFlag } from "../../close-red-flag";
import { discreetMessage, type Channel, type MessageKind } from "@/lib/contact/messages";
import { AdverseEventForm } from "../../adverse-event-form";
import { allowedChannels, may, purposeById } from "@/lib/consent";
import { conditionLabel } from "@/lib/physical-health";
import { SKIPPED } from "@/lib/check/skip";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canWrite, requireStaff } from "@/lib/staff/auth";
import { scopeOf } from "@/lib/staff/scope";
import { loadCase, loadCaseTrend } from "@/lib/staff/data";
import { seriesFrom, TrendChart } from "@/components/trend-chart";
import { STEP_NAMES } from "@/lib/rules/routing";
import { summaryToText } from "@/lib/summary/build";
import { bankItem } from "@/lib/item-bank";
import { acknowledgeTask, addHistory, closeTask, referToService } from "../../actions";
import { DIRECTORY_IS_DRAFT, serviceById, servicesForStep } from "@/lib/directory";
import { applyFollowUps, latestReferral } from "@/lib/referral/persist";
import { ReferralActions } from "../../referral-actions";
import { PriorityBadge, StaffShell, TASK_LABELS } from "../../staff-header";
import { caseRef } from "@/lib/case-ref";
import { ACTIVITY_WORDS, actorWord } from "@/lib/staff/activity-words";
import { clinicById } from "@/lib/clinics";
import { ActionButton, Countdown } from "../../ui";
import { ContactForm, DecisionForm, DeleteCaseButton, StartReview, SummaryEditor } from "./case-forms";

/** A section with a header bar, as in clinical work tools: title left, status right. */
function Panel({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-xl border border-line-warm bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-line-warm bg-surface px-5 py-3">
        <h2 id={id} className="text-[0.9375rem] font-semibold">{title}</h2>
        {aside}
      </header>
      <div className="flex flex-col gap-3 px-5 py-4">{children}</div>
    </section>
  );
}
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const RECEIPT_WORDS: Record<string, string> = {
  received: "Received", reviewed: "Reviewed", accepted: "Accepted", re_routed: "Re-routed", booked: "Booked",
  first_contact_confirmed: "First contact confirmed", referred: "Referred", closed: "Hand-off closed", contact_attempted: "Tried to call", spoke: "Spoke with patient",
};
const time = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const CONTACT_METHOD: Record<string, string> = { phone: "Phone call", sms: "SMS", whatsapp: "WhatsApp", email: "Email" };
const SAFE_TIME: Record<string, string> = {
  weekday_mornings: "Weekday mornings",
  weekday_evenings: "Weekday evenings",
  weekends: "Weekends",
  any_time: "Any time",
};

const HANDOFF_WORDS = { referred: "Referred", booked: "Booked", first_contact: "First contact", closed: "Closed" } as const;
const PATIENT_ANSWER: Record<string, string> = {
  not_yet: "Not booked yet",
  help: "Needs help booking",
  not_attended: "Didn't see them yet",
};

export default function CasePage({ params }: PageProps<"/staff/case/[id]">) {
  return (
    <Suspense fallback={<ConsoleLoading kind="case" />}>
      <Case params={params} />
    </Suspense>
  );
}

async function Case({ params }: { params: PageProps<"/staff/case/[id]">["params"] }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Apply any due hand-off rules for this case first, so the panel is current.
  await applyFollowUps(id).catch((e) => console.error(e));
  const [data, chain, handoff, h] = await Promise.all([loadCase(id, scopeOf(staff)), loadCaseTrend(id, scopeOf(staff)), latestReferral(id), headers()]);
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  if (!data) notFound();
  // Discreet messages staff copy and send themselves, one per channel the person shared and allows.
  const sendChannels = allowedChannels(data.consents).filter((c) =>
    c === "email" ? Boolean(data.session.contact_email) : Boolean(data.session.contact_phone),
  ) as Channel[];
  const messagesFor = (kind: MessageKind) =>
    Object.fromEntries(
      sendChannels.map((c) => [
        c,
        discreetMessage(kind, c, caseRef(id), kind === "followup" && data.session.follow_up_token ? `${origin}/f/${data.session.follow_up_token}` : `${origin}/return`),
      ]),
    ) as Partial<Record<Channel, string>>;
  const sentCount = (kind: MessageKind) => data.activity.filter((a) => a.action === `patient_notified_${kind}`).length;
  const preferred = (data.session.contact_method ?? null) as Channel | null;
  const noContact = !data.session.contact_phone && !data.session.contact_email;
  const trend = chain && chain.sessions.length > 1 ? seriesFrom(chain.points) : [];
  const pathLabel = (p: string) =>
    p === "contact" ? "Call-back only" : p === "followup" ? "Follow-up check-in" : `${p[0].toUpperCase()}${p.slice(1)} check-in`;
  const write = canWrite(staff);
  const { session, proposal, decision, summary } = data;
  const signed = Boolean(summary?.signed_at);
  const summaryText = summary?.edited?.text ?? summaryToText(data.draftLines);
  const openTasks = data.tasks.filter((t) => !t.closed_at);
  // The level the clinician settled on: their override, else the accepted proposal (null = urgent pathway).
  const decidedStep = decision?.action === "override" ? decision.new_step : proposal?.urgent ? null : (proposal?.step ?? null);
  const topTier = ["imminent", "urgent", "elevated", "normal"].find((tier) => openTasks.some((t) => t.priority === tier));
  // The answers a clinician most needs to see verbatim: any item above zero on the risk instruments.
  const riskAnswers = data.answers.filter(
    (a) => a.value > 0 && /^(PHQ9-9|QC_SUICIDE|ASQ|CSSRS_SCREENER|RED_FLAG|BPD_ADHD_EXTRA)/.test(a.item_id),
  );

  // Where the case stands, in the order a clinician works through it.
  const progress = [
    { label: "Acknowledged", next: "Acknowledge the open tasks", done: data.tasks.every((t) => t.acknowledged_at || t.closed_at) },
    { label: "Level decided", next: "Accept or override the proposed level", done: Boolean(decision) || !proposal },
    { label: "Summary signed", next: "Check and sign the summary", done: signed },
    ...(session.contact_phone
      ? [{ label: "Patient contacted", next: "Call the patient and log the call", done: data.contacts.some((c) => c.outcome === "spoke") }]
      : []),
    { label: "Tasks closed", next: "Close the open tasks", done: openTasks.length === 0 },
  ];
  const nextStep = progress.find((p) => !p.done);
  // Repeated lines (the same person opening the case several times) are shown once with a count.
  const views = data.activity.filter((a) => a.action === "case_viewed").length;
  const activity = data.activity.filter((a) => a.action !== "case_viewed").reduce<{ a: (typeof data.activity)[number]; n: number }[]>((rows, a) => {
    const last = rows.at(-1);
    if (last && last.a.action === a.action && last.a.actor === a.actor) last.n += 1;
    else rows.push({ a, n: 1 });
    return rows;
  }, []);

  return (
    <StaffShell staff={staff} active="case">
      <StartReview sessionId={id} />

      {/* Header: which case, how urgent, and the facts needed before reading on. */}
      <nav aria-label="Breadcrumb" className="-mb-2 text-[0.8125rem] text-muted">
        <Link href="/staff" className="underline underline-offset-2">Queue</Link> <span aria-hidden="true">/</span> <span aria-current="page">{caseRef(id)}</span>
      </nav>

      {/* Case banner: stays in view while scrolling, like the patient banner in clinical records. */}
      <div className="z-10 overflow-hidden lg:sticky lg:top-0 rounded-xl border border-line-warm bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.05)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[1.375rem] leading-tight font-semibold tracking-[-0.01em] tabular-nums">{caseRef(id)}</h1>
            {topTier && <PriorityBadge priority={topTier} />}
            {openTasks.some((t) => t.escalated_at) && (
              <span className="rounded-md border border-danger px-2 py-0.5 text-[0.8125rem] font-semibold text-danger">Escalated</span>
            )}
            {noContact && (
              <span className="rounded-lg border border-line bg-sage-mist px-2 py-0.5 text-[0.8125rem] font-semibold text-text-2">No contact details: timeline only</span>
            )}
            {data.activity.some((a) => a.action === "deletion_requested") && (
              <span className="rounded-lg border border-line bg-sky px-2 py-0.5 text-[0.8125rem] font-semibold text-blue">Deletion requested</span>
            )}
            <span className={`rounded-lg px-2 py-0.5 text-[0.8125rem] font-semibold ${signed ? "bg-brand text-white" : "border border-line text-text-2"}`}>
              {signed ? "Signed" : "Not yet signed"}
            </span>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[0.8125rem]">
            {[
              ["Path", pathLabel(session.path)],
              ...(session.clinic_id ? [["Via", clinicById(session.clinic_id)?.name ?? "A clinic's website"]] : []),
              ["Received", time(session.created_at)],
              ["Phone", session.contact_phone ?? "Not shared"],
              ["Language", session.preferred_language ?? "Not given"],
              ["Proposed", proposal ? (proposal.urgent ? "Urgent pathway" : `Step ${proposal.step}`) : "None yet"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted uppercase">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col gap-2 border-t border-line-warm bg-sage-mist px-5 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <ol aria-label="Case progress" className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[0.8125rem]">
            {progress.map((p, i) => (
              <li key={p.label} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true" className={`h-px w-5 ${p.done ? "bg-brand" : "bg-line"}`} />}
                <span
                  aria-hidden="true"
                  className={`grid size-5 place-items-center rounded-full text-[0.6875rem] font-semibold ${
                    p.done ? "bg-brand text-white" : p === nextStep ? "border-2 border-primary text-primary-dark" : "border border-line text-muted"
                  }`}
                >
                  {p.done ? "✓" : i + 1}
                </span>
                <span className={p.done ? "text-text-2" : p === nextStep ? "font-semibold text-ink" : "text-muted"}>
                  {p.label}
                  <span className="sr-only">{p.done ? " (done)" : " (to do)"}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="text-[0.875rem]">
            {nextStep ? (
              <>
                <span className="text-muted">Next: </span>
                <strong className="font-semibold">{nextStep.next}</strong>
              </>
            ) : (
              <strong className="font-semibold text-brand">All steps done</strong>
            )}
          </p>
        </div>
      </div>

      {data.activity.some((a) => a.action === "deletion_requested") && (
        <div role="note" className="flex flex-col gap-2 rounded-xl border border-line bg-sky px-5 py-3.5">
          <p className="text-[0.875rem]">
            <strong className="font-semibold">The patient asked to delete their data.</strong> It is kept only while a red flag is
            open. Once you&apos;ve been in touch and closed the red flag task, delete it.
          </p>
          {write && <DeleteCaseButton sessionId={id} />}
        </div>
      )}

      {!data.consents.clinician_review && !session.taken_over && (
        <p className="rounded-lg bg-sage-soft px-5 py-3 text-caption">This person did not agree to clinician review.</p>
      )}

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-5">
          {/* --- Summary --------------------------------------------------- */}
          <Panel
            id="summary-h"
            title="Summary"
            aside={
              <span className={`rounded-lg px-2 py-0.5 text-[0.8125rem] font-semibold ${signed ? "bg-brand text-white" : "bg-ai-soft text-ai-ink"}`}>
                {signed ? "AI-drafted, clinician-verified" : "AI-drafted, not yet verified"}
              </span>
            }
          >
            {signed || !write ? (
              <p className="whitespace-pre-line">{summaryText}</p>
            ) : summary ? (
              <SummaryEditor key={summary.review_started_at} sessionId={id} initialText={summaryText} />
            ) : (
              <p className="text-muted">Preparing the summary…</p>
            )}
            {signed && summary?.signed_at && <p className="text-small text-muted">Signed {time(summary.signed_at)}</p>}
            {data.draftLines.some((l) => l.quote) && (
              <details className="text-caption">
                <summary className="min-h-10 cursor-pointer content-center text-primary-dark underline">
                  Patient&apos;s own words behind each line
                </summary>
                <dl className="flex flex-col gap-2 pt-1">
                  {data.draftLines.filter((l) => l.quote).map((l) => (
                    <div key={l.key}>
                      <dt className="font-semibold">{l.label}</dt>
                      <dd className="text-text-2">&ldquo;{l.quote}&rdquo;</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </Panel>

          {/* --- Red flags, with the rule that fired and the trigger ------- */}
          {data.redFlags.length > 0 && (
            <Panel id="flags-h" title="Red flags">
              <ul className="flex flex-col gap-3">
                {data.redFlags.map((r) => (
                  <li key={r.rule_id} className="flex flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={r.tier} />
                      <strong className="font-semibold">{r.rule_id}</strong>
                      <span className="text-small text-muted">{time(r.created_at)}</span>
                    </span>
                    <span className="text-caption text-text-2">Trigger: {r.trigger}</span>
                    {r.quote && <span className="text-caption text-text-2">Patient wrote: &ldquo;{r.quote}&rdquo;</span>}
                  </li>
                ))}
              </ul>
              {riskAnswers.length > 0 && (
                <ul className="flex flex-col gap-1 border-t border-line-warm pt-3 text-caption">
                  {riskAnswers.map((a) => {
                    const item = bankItem(a.item_id);
                    const label = a.value === SKIPPED ? "Prefer not to say" : (item?.options.find((o) => o.value === a.value)?.label.en ?? String(a.value));
                    return (
                      <li key={a.item_id}>
                        <span className="text-muted">{a.item_id}:</span> {item?.text.en} <strong className="font-semibold">{label}</strong>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}

          {/* --- Scores ---------------------------------------------------- */}
          {data.scores.length > 0 && (
          <Panel id="scores-h" title="Scores">
            {data.scores.length === 0 ? (
              <p className="text-caption text-muted">No questionnaire was completed.</p>
            ) : (
              <ul className="flex flex-wrap gap-x-8 gap-y-2">
                {data.scores.map((s) => (
                  <li key={s.instrument}>
                    <span className="text-caption text-muted">{s.instrument}</span>
                    <span className="block text-[1.5rem] leading-tight font-semibold tabular-nums">{s.total}</span>
                    <span className="text-caption">{s.band.replaceAll("_", " ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          )}

          {/* --- Follow-up trend: the person's check-ins over time ------ */}
          {chain && chain.sessions.length > 1 && (
            <Panel id="trend-h" title="Over time" aside={<span className="text-[0.75rem] text-muted">{chain.sessions.length} check-ins · lower is better</span>}>
              <ol className="flex flex-col gap-1 text-[0.8125rem]">
                {chain.sessions.map((c, i) => (
                  <li key={c.id} className="flex flex-wrap gap-x-2">
                    <span className="w-24 text-muted">{i === 0 ? "First" : `Follow-up ${i}`}</span>
                    {c.id === id ? (
                      <strong className="font-semibold tabular-nums">{caseRef(c.id)} (this case)</strong>
                    ) : (
                      <Link href={`/staff/case/${c.id}`} className="tabular-nums">{caseRef(c.id)}</Link>
                    )}
                    <span className="text-muted">{time(c.created_at)} · {pathLabel(c.path)}</span>
                  </li>
                ))}
              </ol>
              {trend.length > 0 ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  {trend.map((s) => (
                    <TrendChart key={s.title} series={s} color="var(--primary)" />
                  ))}
                </div>
              ) : (
                <p className="text-[0.875rem] text-muted">No scores to compare yet.</p>
              )}
            </Panel>
          )}

          {/* --- Conversation ---------------------------------------------- */}
          {data.messages.length > 0 && (
            <Panel id="chat-h" title="Conversation">
              <ol className="flex flex-col gap-2 text-caption">
                {data.messages.map((m) => (
                  <li key={m.id}>
                    <span className="font-semibold">{m.role === "patient" ? "Patient" : m.role === "assistant" ? "AI assistant" : "App"}:</span>{" "}
                    <span className="text-text-2">{m.text}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          <Panel id="msgs-h" title="Messages">
            {data.teamMessages.length === 0 ? (
              <p className="text-caption text-muted">No messages yet. A reply shows on the patient&apos;s timeline.</p>
            ) : (
              <ol className="flex flex-col gap-2 text-caption">
                {data.teamMessages.map((m) => (
                  <li
                    key={m.created_at}
                    className={`max-w-[85%] rounded-xl px-3 py-2 ${m.from_patient ? "self-start bg-sage-mist" : "self-end bg-sky"}`}
                  >
                    <span className="block text-[0.75rem] font-semibold text-muted">
                      {m.from_patient ? "Patient" : "Care team"} · {time(m.created_at)}
                    </span>
                    <span className="whitespace-pre-line">{m.body}</span>
                  </li>
                ))}
              </ol>
            )}
            {write && <ReplyBox sessionId={id} />}
            {write && data.teamMessages.some((m) => !m.from_patient) && (
              <div className="flex flex-col gap-2 border-t border-line-warm pt-3">
                <span className="text-[0.875rem] font-semibold">Let them know there&apos;s a reply</span>
                <DiscreetMessage sessionId={id} kind="reply" messages={messagesFor("reply")} defaultChannel={preferred} sentCount={sentCount("reply")} />
              </div>
            )}
          </Panel>

          {session.follow_up_token && (
            <Panel id="followup-link-h" title="Follow-up link">
              <FollowUpLinkPanel
                sessionId={id}
                link={`${origin}/f/${session.follow_up_token}`}
                sentCount={data.activity.filter((a) => a.action === "follow_up_link_sent").length}
              />
            </Panel>
          )}

          {write && (
            <Panel id="close-h" title={session.closed_at ? "Case closed" : "Close case"}>
              {session.closed_at ? (
                <p className="text-caption">
                  Closed {time(session.closed_at)}: {CLOSURE_REASONS[session.closure_reason as keyof typeof CLOSURE_REASONS] ?? session.closure_reason}.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-[0.875rem] font-semibold">Closing message (needed to close as Unreachable)</span>
                  <DiscreetMessage sessionId={id} kind="closing" messages={messagesFor("closing")} defaultChannel={preferred} sentCount={sentCount("closing")} />
                </div>
                <CloseCaseForm
                  sessionId={id}
                  state={closureStateFrom(data, handoff, staff.role === "supervisor", staff.id)}
                />
                </div>
              )}
            </Panel>
          )}

          <Panel id="activity-h" title="Activity">
            <ol className="flex flex-col gap-1.5 text-[0.875rem]">
              {activity.map(({ a, n }, i) => (
                <li key={a.created_at + a.action + i} className="flex flex-wrap gap-x-3">
                  <span className="w-28 shrink-0 text-muted tabular-nums">{time(a.created_at)}</span>
                  <span className="font-medium">
                    {ACTIVITY_WORDS[a.action] ?? a.action.replaceAll("_", " ")}
                    {n > 1 && <span className="font-normal text-muted"> ×{n}</span>}
                  </span>
                  <span className="text-muted">{actorWord(a.actor)}</span>
                </li>
              ))}
            </ol>
              {views > 0 && (
                <p className="text-[0.75rem] text-muted">Opened {views} {views === 1 ? "time" : "times"} by the care team.</p>
              )}
            </Panel>
        </div>

        <div className="flex flex-col gap-5">
          {/* --- Proposed level and decision ------------------------------- */}
          <Panel id="proposal-h" title="Proposed level">
            {!proposal ? (
              <p className="text-caption text-muted">No proposal yet.</p>
            ) : (
              <>
                <p className="text-[1.25rem] leading-snug font-semibold">
                  {proposal.urgent ? "Urgent pathway" : `Step ${proposal.step}: ${STEP_NAMES[proposal.step ?? 0]}`}
                </p>
                <ul className="list-disc ps-5 text-caption text-text-2">
                  {proposal.reasons.map((reason, i) => (
                    <li key={proposal.rule_ids[i] ?? i}>
                      {reason} <span className="text-muted">({proposal.rule_ids[i]})</span>
                    </li>
                  ))}
                </ul>
                {decision ? (
                  <p className="rounded-lg bg-sage-soft px-4 py-3 text-caption">
                    <strong className="font-semibold">{decision.action === "accept" ? "Accepted" : `Overridden to step ${decision.new_step}`}</strong>{" "}
                    {time(decision.created_at)}
                    {decision.reason && <span className="block text-text-2">Reason: {decision.reason}</span>}
                  </p>
                ) : (
                  write && <DecisionForm sessionId={id} proposalId={proposal.id} urgent={proposal.urgent} />
                )}
              </>
            )}
          </Panel>

          {/* --- Tasks and clocks ------------------------------------------ */}
          <Panel id="tasks-h" title="Open tasks">
            {openTasks.length === 0 ? (
              <p className="text-caption text-muted">None.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {openTasks.map((t) => (
                  <li key={t.id} className="flex flex-col gap-2 text-caption">
                    <span className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={t.priority} />
                      <span className="font-medium">{TASK_LABELS[t.type] ?? t.type}</span>
                      <Countdown dueAt={t.due_at} />
                    </span>
                    {t.reason && <span className="text-text-2">{t.reason.slice(t.reason.indexOf(":") + 1).trim()}</span>}
                    {write && t.type === "send_reminder" && t.reason && (
                      <DiscreetMessage
                        sessionId={id}
                        kind={t.reason.split(":")[0]}
                        messages={messagesFor(t.reason.split(":")[0] as MessageKind)}
                        defaultChannel={preferred}
                        taskId={t.id}
                        sentCount={sentCount(t.reason.split(":")[0] as MessageKind)}
                      />
                    )}
                    {t.escalated_at && <strong className="font-semibold text-danger">Escalated to supervisor</strong>}
                    {write && (
                      <span className="flex flex-wrap gap-2">
                        {!t.acknowledged_at && <ActionButton action={acknowledgeTask.bind(null, t.id)}>Acknowledge</ActionButton>}
                        {t.type === "red_flag" ? (
                          <CloseRedFlag taskId={t.id} spokeLogged={data.contacts.some((c) => c.outcome === "spoke")} isSupervisor={staff.role === "supervisor"} />
                        ) : (
                          <ActionButton action={closeTask.bind(null, t.id)}>
                            {t.type === "supervisor_review" ? "Mark reviewed (supervisor)" : "Close task"}
                          </ActionButton>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* --- Contact ---------------------------------------------------- */}
          <Panel id="contact-h" title="Contact">
            {session.contact_phone || session.contact_email ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-caption">
                {(
                  [
                    ["Reach by", session.contact_method ? CONTACT_METHOD[session.contact_method] : null],
                    ["May contact by", allowedChannels(data.consents).map((c) => CONTACT_METHOD[c]).join(", ") || "No channel allowed at the moment"],
                    ["Phone", session.contact_phone],
                    ["Email", session.contact_email],
                    ["Safe times", session.contact_times?.length ? session.contact_times.map((t) => SAFE_TIME[t] ?? t).join(", ") : null],
                    ["Voicemail", session.contact_leave_message === null ? null : session.contact_leave_message ? "OK to leave a message" : "Do not leave a message"],
                    ["Best time", session.callback_time],
                    ["Language", session.preferred_language],
                    ["Clinician", session.preferred_clinician_gender],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className="text-[0.875rem] text-text-2">No phone number shared. Review the case; the person can share a number through &ldquo;Talk to someone&rdquo; or &ldquo;Alert my care team&rdquo;.</p>
            )}
            {data.contacts.length > 0 && (
              <ul className="flex flex-col gap-1 border-t border-line-warm pt-2 text-caption">
                {data.contacts.map((c) => (
                  <li key={c.created_at}>
                    {time(c.created_at)}: {c.outcome === "spoke" ? "Spoke with patient" : "Called, no answer"}
                    {c.note && <span className="text-text-2"> ({c.note})</span>}
                  </li>
                ))}
              </ul>
            )}
            {write && session.contact_phone && <ContactForm sessionId={id} safeTimes={session.contact_times} />}
            {write && (
              <div className="flex flex-col gap-1.5 border-t border-line-warm pt-3">
                <span className="text-[0.875rem] font-semibold">Lost their return code?</span>
                <SendNewReturnCode sessionId={id} channels={sendChannels} origin={origin} />
              </div>
            )}
          </Panel>

          {/* --- Referral: services for the decided step ------------------ */}
          {data.receipt.length > 0 && (
            <Panel
              id="refer-h"
              title={handoff && handoff.status !== "closed" ? "Hand-off" : "Refer to a service"}
              aside={
                DIRECTORY_IS_DRAFT ? (
                  <span className="rounded-md border border-[#e3c27a] bg-[#fbefd2] px-2 py-0.5 text-[0.75rem] font-semibold text-[#5c3a00]">Details to confirm</span>
                ) : undefined
              }
            >
              {handoff && handoff.status !== "closed" ? (
                <div className="flex flex-col gap-3">
                  <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]" aria-label="Hand-off status">
                    {(["referred", "booked", "first_contact", "closed"] as const).map((st, i) => {
                      const order = ["referred", "booked", "first_contact", "closed"];
                      const done = order.indexOf(handoff.status) >= i;
                      return (
                        <li key={st} className={`rounded-full px-2.5 py-0.5 ${done ? "bg-primary font-semibold text-white" : "bg-sage-soft text-muted"}`}>
                          {HANDOFF_WORDS[st]}
                        </li>
                      );
                    })}
                  </ol>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.875rem]">
                    <dt className="text-muted">Service</dt>
                    <dd>{serviceById(handoff.service_id)?.name ?? handoff.service_id}</dd>
                    <dt className="text-muted">Referred</dt>
                    <dd>{time(handoff.referred_at)}{handoff.urgent && <strong className="font-semibold text-danger"> · urgent: back to the queue after 48 h without progress</strong>}</dd>
                    {handoff.booked_for && (
                      <>
                        <dt className="text-muted">Appointment</dt>
                        <dd>{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${handoff.booked_for}T12:00:00`))}</dd>
                      </>
                    )}
                    {handoff.last_patient_answer && (
                      <>
                        <dt className="text-muted">Patient said</dt>
                        <dd>{PATIENT_ANSWER[handoff.last_patient_answer] ?? handoff.last_patient_answer}</dd>
                      </>
                    )}
                    {handoff.stalled_at && (
                      <>
                        <dt className="text-muted">Stalled</dt>
                        <dd className="font-semibold text-danger">
                          {handoff.help_requested_at ? "Patient asked for help booking" : "Not booked or not seen in time"} · {time(handoff.stalled_at)}
                        </dd>
                      </>
                    )}
                  </dl>
                  {write && <ReferralActions sessionId={id} status={handoff.status} />}
                </div>
              ) : !decision && !proposal?.urgent ? (
                <p className="text-[0.875rem] text-muted">Accept or override the proposed level first; services are matched to it.</p>
              ) : decidedStep === 0 ? (
                <p className="text-[0.875rem] text-text-2">Step 0 is self-help: point the person to the coping cards. No referral needed.</p>
              ) : (
                <>
                  <p className="text-[0.8125rem] text-muted">
                    {decidedStep === null ? "Urgent pathway: all services shown." : `Matched to step ${decidedStep}: ${STEP_NAMES[decidedStep]}.`} Share
                    details with a service only with the person&apos;s agreement.
                  </p>
                  <ul className="flex flex-col gap-3">
                    {servicesForStep(decidedStep).map((svc) => (
                      <li key={svc.id} className="flex flex-col gap-2 rounded-lg border border-line-warm px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <strong className="font-semibold">{svc.name}</strong>
                          <span className="text-[0.75rem] text-muted">{svc.kind}</span>
                        </div>
                        <p className="text-[0.8125rem] text-text-2">{svc.about}</p>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.8125rem]">
                          <dt className="text-muted">How</dt>
                          <dd>{svc.mode} · {svc.area}</dd>
                          <dt className="text-muted">Booking</dt>
                          <dd>{svc.booking}</dd>
                          <dt className="text-muted">Cost</dt>
                          <dd>{svc.cost}</dd>
                        </dl>
                        {write && (
                          <span>
                            <ActionButton variant="primary" action={referToService.bind(null, id, svc.id)}>
                              Refer to this service
                            </ActionButton>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          )}

          {/* --- What the patient sees -------------------------------------- */}
          {data.receipt.length > 0 && (
          <Panel id="receipt-h" title="Patient's receipt">
            {data.receipt.length === 0 ? (
              <p className="text-caption text-muted">No receipt (crisis path, or no clinician review).</p>
            ) : (
              <ol className="flex flex-col gap-1 text-caption">
                {data.receipt.map((r) => (
                  <li key={r.created_at + r.status}>
                    {time(r.created_at)}:{" "}
                    <strong className="font-semibold">
                      {r.service_id ? `Referred to ${serviceById(r.service_id)?.name ?? r.service_id}` : (RECEIPT_WORDS[r.status] ?? r.status)}
                    </strong>
                    {r.reason && <span className="text-text-2"> ({r.reason})</span>}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          )}

          {/* --- Consent and history ---------------------------------------- */}
          <Panel id="health-h" title="Physical health and medicines">
            {!may.sharePhysicalHealth(data.consents) ? (
              <p className="text-caption text-muted">Not shared. The person did not choose to share physical health.</p>
            ) : (session.physical_conditions?.length ?? 0) > 0 || session.physical_other ? (
              <ul className="flex list-disc flex-col gap-0.5 ps-5 text-caption">
                {session.physical_conditions?.map((c) => <li key={c}>{conditionLabel(c)}</li>)}
                {session.physical_other && <li>Other: {session.physical_other}</li>}
              </ul>
            ) : (
              <p className="text-caption text-muted">Shared: none of the listed conditions.</p>
            )}
            <p className="text-[0.75rem] text-muted">Self-reported, not verified.</p>
            {may.exportToGp(data.consents) ? (
              <a href={`/staff/case/${id}/gp-summary`} className="inline-flex min-h-10 items-center self-start text-caption font-semibold">
                Download family doctor summary (FHIR R4)
              </a>
            ) : (
              <p className="text-caption text-muted">No consent to share a summary with the family doctor.</p>
            )}
            <p className="text-[0.75rem] text-muted">Sending to Malaffi (Abu Dhabi health information exchange) is on the roadmap.</p>
          </Panel>

          {write && (
            <Panel id="adverse-h" title="Safety reporting">
              <AdverseEventForm sessionId={id} />
            </Panel>
          )}

          <Panel id="consent-h" title="Consent and history">
            <ul className="text-caption">
              {Object.entries(data.consents).map(([purpose, granted]) => (
                <li key={purpose}>
                  {purposeById(purpose)?.title ?? sentence(purpose.replaceAll("_", " "))}:{" "}
                  <strong className="font-semibold">{granted ? "Yes" : "No"}</strong>
                </li>
              ))}
            </ul>
            <p className="text-caption">
              Known history:{" "}
              {[session.history_bpd && "BPD", session.history_adhd && "ADHD"].filter(Boolean).join(", ") || "none recorded"}
              {session.history_source && ` (${session.history_source.replaceAll("_", " ")})`}
            </p>
            {write && (
              <span className="flex flex-wrap gap-2">
                {!session.history_bpd && <ActionButton action={addHistory.bind(null, id, "bpd")}>Add BPD history</ActionButton>}
                {!session.history_adhd && <ActionButton action={addHistory.bind(null, id, "adhd")}>Add ADHD history</ActionButton>}
              </span>
            )}
          </Panel>
        </div>
      </div>



    </StaffShell>
  );
}
