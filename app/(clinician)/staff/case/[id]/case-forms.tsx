"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decide, deleteCaseData, logContact, saveSummary, signSummary, startReview } from "../../actions";
import { ActionButton } from "../../ui";
import { STEP_NAMES } from "@/lib/rules/routing";

const field = "rounded-lg border border-line bg-surface px-3 py-2 text-caption focus:border-primary";

/** Opening the case starts the review timer and writes the audit entry. */
export function StartReview({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  useEffect(() => {
    // Reload only when a summary draft was just created (otherwise the page is already current).
    startReview(sessionId)
      .then((r) => r.created && router.refresh())
      .catch(() => {});
  }, [sessionId, router]);
  return null;
}

/** One click to accept; a short form with a required reason to override (research: friction matches risk). */
export function DecisionForm({ sessionId, proposalId, urgent }: { sessionId: string; proposalId: string; urgent: boolean }) {
  const [overriding, setOverriding] = useState(false);
  const [step, setStep] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <ActionButton
          variant="primary"
          action={() => decide({ sessionId, proposalId, action: "accept", newStep: null, reason: "" })}
        >
          {urgent ? "Accept urgent pathway" : "Accept proposed step"}
        </ActionButton>
        <button
          type="button"
          aria-expanded={overriding}
          onClick={() => setOverriding((o) => !o)}
          className="min-h-9 cursor-pointer rounded-full border border-line bg-surface px-3 text-[0.875rem] font-medium hover:bg-sage-soft"
        >
          Override
        </button>
      </div>
      {overriding && (
        <div className="flex flex-col gap-2 rounded-lg bg-sage-soft p-4">
          <label className="flex flex-col gap-1 text-caption">
            <span className="font-semibold">New step</span>
            <select value={step} onChange={(e) => setStep(e.target.value)} className={field}>
              <option value="">Choose a step</option>
              {STEP_NAMES.map((name, i) => (
                <option key={name} value={i}>
                  Step {i}: {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-caption">
            <span className="font-semibold">Reason (required, logged)</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} className={field} />
          </label>
          <ActionButton
            disabled={step === "" || reason.trim() === ""}
            action={() => decide({ sessionId, proposalId, action: "override", newStep: Number(step), reason })}
          >
            Save override
          </ActionButton>
        </div>
      )}
    </div>
  );
}

/** Editable in place; the label changes from "AI-drafted" to "clinician-verified" on sign-off. */
export function SummaryEditor({ sessionId, initialText }: { sessionId: string; initialText: string }) {
  const [text, setText] = useState(initialText);
  const [saved, setSaved] = useState(true);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="sr-only">Summary text</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          rows={9}
          maxLength={4000}
          className={`${field} text-base leading-normal`}
        />
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <button
          type="button"
          disabled={pending || saved}
          onClick={() =>
            start(async () => {
              const r = await saveSummary(sessionId, text).catch(() => ({ ok: false as const, error: "That didn't save." }));
              setError(r.ok ? "" : r.error);
              if (r.ok) setSaved(true);
            })
          }
          className="min-h-9 cursor-pointer rounded-full border border-line bg-surface px-3 text-[0.875rem] font-medium hover:bg-sage-soft disabled:cursor-default disabled:opacity-50"
        >
          {pending ? "Saving…" : saved ? "Saved" : "Save edits"}
        </button>
        <ActionButton variant="primary" disabled={!saved} action={() => signSummary(sessionId)}>
          Sign summary
        </ActionButton>
      </div>
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ContactForm({ sessionId }: { sessionId: string }) {
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-caption">
        <span className="font-semibold">Note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={`${field} min-h-9`} />
      </label>
      <div className="flex flex-wrap gap-2">
        <ActionButton action={() => logContact(sessionId, "called_no_answer", note)}>Called, no answer</ActionButton>
        <ActionButton action={() => logContact(sessionId, "spoke", note)}>Spoke with patient</ActionButton>
      </div>
    </div>
  );
}

/** Deletes the case after the patient asked; then back to the queue. */
export function DeleteCaseButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption font-semibold">Delete everything for this case? This can&apos;t be undone.</span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteCaseData(sessionId).catch(() => ({ ok: false as const, error: "That didn't work." }));
                if (r.ok) router.push("/staff");
                else setError(r.error);
              })
            }
            className="min-h-9 cursor-pointer rounded-full bg-danger px-3 text-[0.875rem] font-medium text-white disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Yes, delete"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="min-h-9 cursor-pointer rounded-full border border-line bg-surface px-3 text-[0.875rem] font-medium">
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-9 cursor-pointer self-start rounded-full border border-line bg-surface px-3 text-[0.875rem] font-medium hover:bg-sage-soft"
        >
          Delete the patient&apos;s data
        </button>
      )}
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
