import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canWrite, requireStaff } from "@/lib/staff/auth";
import { loadCase } from "@/lib/staff/data";
import { STEP_NAMES } from "@/lib/rules/routing";
import { summaryToText } from "@/lib/summary/build";
import { bankItem } from "@/lib/item-bank";
import { acknowledgeTask, addHistory, closeTask, setReceiptStatus } from "../../actions";
import { PriorityBadge, StaffShell, TASK_LABELS } from "../../staff-header";
import { caseRef } from "@/lib/case-ref";
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
const ACTIVITY_WORDS: Record<string, string> = {
  consent_recorded: "Consent recorded", check_in_completed: "Check-in completed", red_flag_raised: "Red flag raised",
  contact_shared: "Contact details shared", callback_requested: "Call-back requested", case_viewed: "Case opened",
  task_acknowledged: "Task acknowledged", task_closed: "Task closed", task_escalated: "Escalated to supervisor",
  proposal_accept: "Proposal accepted", proposal_override: "Proposal overridden", summary_edited: "Summary edited",
  summary_signed: "Summary signed", receipt_booked: "Marked booked", receipt_first_contact_confirmed: "First contact confirmed",
  contact_logged: "Contact logged", deletion_requested: "Patient asked to delete their data", coping_not_helping: "Coping card not helping", history_added: "History added", history_self_reported: "History self-reported",
  safety_check_asked: "Safety check asked", safety_check_answered_no: "Safety check answered no",
  ai_reply_blocked: "AI reply blocked by guardrail", ai_unavailable_fallback: "AI unavailable, questionnaire used",
};
const actorWord = (actor: string) => (actor.startsWith("clinician") ? "Clinician" : actor.startsWith("supervisor") ? "Supervisor" : actor === "patient" ? "Patient" : "System");
const RECEIPT_WORDS: Record<string, string> = {
  received: "Received", reviewed: "Reviewed", accepted: "Accepted", re_routed: "Re-routed", booked: "Booked",
  first_contact_confirmed: "First contact confirmed", contact_attempted: "Tried to call", spoke: "Spoke with patient",
};
const time = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default function CasePage({ params }: PageProps<"/staff/case/[id]">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading the case…</p>}>
      <Case params={params} />
    </Suspense>
  );
}

async function Case({ params }: { params: PageProps<"/staff/case/[id]">["params"] }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await loadCase(id);
  if (!data) notFound();
  const write = canWrite(staff);
  const { session, proposal, decision, summary } = data;
  const signed = Boolean(summary?.signed_at);
  const summaryText = summary?.edited?.text ?? summaryToText(data.draftLines);
  const openTasks = data.tasks.filter((t) => !t.closed_at);
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
  const activity = data.activity.reduce<{ a: (typeof data.activity)[number]; n: number }[]>((rows, a) => {
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
        <Link href="/staff">Queue</Link> <span aria-hidden="true">/</span> <span aria-current="page">{caseRef(id)}</span>
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
            {data.activity.some((a) => a.action === "deletion_requested") && (
              <span className="rounded-lg border border-line bg-sky px-2 py-0.5 text-[0.8125rem] font-semibold text-blue">Deletion requested</span>
            )}
            <span className={`rounded-lg px-2 py-0.5 text-[0.8125rem] font-semibold ${signed ? "bg-brand text-white" : "border border-line text-text-2"}`}>
              {signed ? "Signed" : "Not yet signed"}
            </span>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[0.8125rem]">
            {[
              ["Path", session.path === "contact" ? "Call-back only" : `${session.path[0].toUpperCase()}${session.path.slice(1)} check-in`],
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
              <span className={`rounded-lg px-2 py-0.5 text-[0.8125rem] font-semibold ${signed ? "bg-brand text-white" : "border border-[#e3c27a] bg-[#fbefd2] text-[#5c3a00]"}`}>
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
                    const label = item?.options.find((o) => o.value === a.value)?.label.en ?? String(a.value);
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
                    {t.escalated_at && <strong className="font-semibold text-danger">Escalated to supervisor</strong>}
                    {write && (
                      <span className="flex flex-wrap gap-2">
                        {!t.acknowledged_at && <ActionButton action={acknowledgeTask.bind(null, t.id)}>Acknowledge</ActionButton>}
                        <ActionButton action={closeTask.bind(null, t.id)}>Close task</ActionButton>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* --- Contact ---------------------------------------------------- */}
          <Panel id="contact-h" title="Contact">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-caption">
              <dt className="text-muted">Phone</dt>
              <dd>{session.contact_phone ?? "Not shared"}</dd>
              <dt className="text-muted">Best time</dt>
              <dd>{session.callback_time ?? "Not given"}</dd>
              <dt className="text-muted">Language</dt>
              <dd>{session.preferred_language ?? "Not given"}</dd>
              <dt className="text-muted">Clinician</dt>
              <dd>{session.preferred_clinician_gender ?? "No preference given"}</dd>
            </dl>
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
            {write && <ContactForm sessionId={id} />}
          </Panel>

          {/* --- What the patient sees -------------------------------------- */}
          <Panel id="receipt-h" title="Patient's receipt">
            {data.receipt.length === 0 ? (
              <p className="text-caption text-muted">No receipt (crisis path, or no clinician review).</p>
            ) : (
              <ol className="flex flex-col gap-1 text-caption">
                {data.receipt.map((r) => (
                  <li key={r.created_at + r.status}>
                    {time(r.created_at)}: <strong className="font-semibold">{RECEIPT_WORDS[r.status] ?? r.status}</strong>
                    {r.reason && <span className="text-text-2"> ({r.reason})</span>}
                  </li>
                ))}
              </ol>
            )}
            {write && data.receipt.length > 0 && (
              <span className="flex flex-wrap gap-2">
                <ActionButton action={setReceiptStatus.bind(null, id, "booked")}>Mark booked</ActionButton>
                <ActionButton action={setReceiptStatus.bind(null, id, "first_contact_confirmed")}>First contact confirmed</ActionButton>
              </span>
            )}
          </Panel>

          {/* --- Consent and history ---------------------------------------- */}
          <Panel id="consent-h" title="Consent and history">
            <ul className="text-caption">
              {Object.entries(data.consents).map(([purpose, granted]) => (
                <li key={purpose}>
                  {sentence(purpose.replaceAll("_", " "))}: <strong className="font-semibold">{granted ? "Yes" : "No"}</strong>
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
