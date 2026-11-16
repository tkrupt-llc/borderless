"use client";

import { useEffect, useState } from "react";
import { loadReceipt } from "../../actions";
import { RESULT_KEY, SUBMITTED_AT_KEY, useStoredValue } from "@/lib/check/local-answers";
import { buildReceipt, type ReceiptStep, type ReceiptView } from "@/lib/receipt/build";

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
      </div>

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
    </>
  );
}

function Step({ step, last }: { step: ReceiptStep; last: boolean }) {
  const { state } = step;
  return (
    <li className="flex gap-3.5">
      <div className="flex flex-col items-center" aria-hidden="true">
        {state === "done" && (
          <div className="flex size-7 items-center justify-center rounded-full bg-primary">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {state === "now" && (
          <div className="flex size-7 items-center justify-center rounded-full border-[3px] border-primary bg-surface">
            <div className="size-2.5 rounded-full bg-primary" />
          </div>
        )}
        {state === "next" && <div className="size-7 rounded-full border-2 border-step-idle bg-surface" />}
        {!last && <div className={`min-h-6 w-0.5 flex-1 ${state === "done" ? "bg-primary" : "bg-line"}`} />}
      </div>
      {state === "now" ? (
        <div className="flex-1 pb-[18px]">
          <div className="rounded-2xl bg-sage px-4 py-3.5">
            <span className="text-caption font-semibold text-primary-dark">Now</span>
            <p className="mt-0.5 font-semibold">{step.title}</p>
            <p className="mt-1 text-caption text-text-on-sage">{step.body}</p>
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
