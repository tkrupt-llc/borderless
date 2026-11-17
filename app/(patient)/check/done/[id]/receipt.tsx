"use client";

import { useEffect, useState } from "react";
import { loadReceipt } from "../../actions";
import { RESULT_KEY, SUBMITTED_AT_KEY, useStoredValue } from "@/lib/check/local-answers";
import { buildReceipt, formatWhen, type ReceiptStep, type ReceiptView } from "@/lib/receipt/build";
import { FollowUpLink } from "@/components/follow-up-link";

function readToken(raw: string | null): string | null {
  try {
    return raw ? (JSON.parse(raw).followUpToken ?? null) : null;
  } catch {
    return null;
  }
}

function readFollowUp(raw: string | null): boolean {
  try {
    return raw ? JSON.parse(raw).followUp === true : false;
  } catch {
    return false;
  }
}

/**
 * The live timeline. The server's version (what the care team has done) is
 * re-read every 10 seconds; until it arrives, or without a database, the
 * timeline is built from the submit time kept in this tab.
 */
export function Receipt() {
  const submittedAt = useStoredValue(SUBMITTED_AT_KEY);
  const followUp = readFollowUp(useStoredValue(RESULT_KEY));
  const followUpToken = readToken(useStoredValue(RESULT_KEY));
  const [server, setServer] = useState<ReceiptView | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      loadReceipt()
        .then((view) => !cancelled && view && setServer(view))
        .catch(() => {});
    load();
    const id = setInterval(() => document.visibilityState === "visible" && load(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const view =
    server ??
    (submittedAt
      ? buildReceipt({ events: [{ status: "received", reason: null, createdAt: submittedAt }], proposal: null, decision: null, followUp })
      : null);

  return (
    <>
      <div className="flex flex-col gap-1.5 px-5 pt-5">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          Thank you. Your check-in is <em className="text-primary">in.</em>
        </h1>
        {view?.ref && (
          <p className="text-caption text-muted">
            Your reference: <strong className="font-semibold text-ink">{view.ref}</strong>. Your care team sees the same
            code.
          </p>
        )}
      </div>

      {view?.messages && view.messages.length > 0 && (
        <section aria-labelledby="msgs-h" className="mx-5 mt-4 flex flex-col gap-2 rounded-2xl bg-sky px-4 py-3.5">
          <h2 id="msgs-h" className="text-[0.8125rem] font-semibold tracking-[0.06em] text-blue uppercase">
            From your care team
          </h2>
          {view.messages.map((m) => (
            <p key={m.at} className="anim-pop text-blue-ink">
              {m.body}
              <span className="mt-0.5 block text-small text-muted">{formatWhen(m.at)}</span>
            </p>
          ))}
        </section>
      )}

      {view ? (
        <ol aria-live="polite" className="flex flex-1 flex-col px-5 pt-5">
          {view.steps.map((step, i) => (
            <Step key={step.key} step={step} last={i === view.steps.length - 1} />
          ))}
        </ol>
      ) : (
        <p className="flex-1 px-5 pt-5 text-text-2">
          There is no check-in to show in this browser. If you sent one from another device, your care team still has
          it.
        </p>
      )}
      {followUp && followUpToken && (
        <div className="px-5 pt-3">
          <FollowUpLink token={followUpToken} from={submittedAt ?? undefined} />
        </div>
      )}
    </>
  );
}

function Step({ step, last }: { step: ReceiptStep; last: boolean }) {
  const { state } = step;
  return (
    <li className="flex gap-3.5">
      <div className="flex flex-col items-center" aria-hidden="true">
        {state === "done" && (
          <div className="flex size-7 items-center justify-center rounded-full bg-blue">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {state === "now" && (
          <div className="anim-pulse flex size-7 items-center justify-center rounded-full border-[3px] border-blue bg-surface">
            <div className="size-2.5 rounded-full bg-blue" />
          </div>
        )}
        {state === "next" && <div className="size-7 rounded-full border-2 border-[#8fa7b0] bg-surface" />}
        {!last && <div className={`min-h-6 w-0.5 flex-1 ${state === "done" ? "bg-blue" : "bg-line"}`} />}
      </div>
      {state === "now" ? (
        <div className="flex-1 pb-[18px]">
          <div className="anim-pop rounded-2xl bg-sky px-4 py-3.5">
            <span className="text-[0.8125rem] font-semibold tracking-[0.06em] text-blue uppercase">Now</span>
            <p className="mt-0.5 font-semibold">{step.title}</p>
            <p className="mt-1 text-caption text-blue-ink">{step.body}</p>
          </div>
        </div>
      ) : (
        <div className={last ? "" : "pb-[18px]"}>
          <strong className="font-semibold">
            <span className="sr-only">{state === "done" ? "Done: " : "Later: "}</span>
            {step.title}
          </strong>
          <p className="mt-0.5 text-caption text-muted">{step.body}</p>
        </div>
      )}
    </li>
  );
}
