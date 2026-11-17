"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteMyData, myDataStatus, type MyDataStatus } from "./actions";

const REASONS_STORE = "bl_my_reasons";

/**
 * Two steps on purpose: "Delete my data", then "Yes, delete everything".
 * No pop-up; the confirmation replaces the button in place.
 */
export function DeleteData() {
  const [status, setStatus] = useState<MyDataStatus | null>(null);
  const [step, setStep] = useState<"idle" | "confirm" | "working" | "deleted" | "held" | "error">("idle");
  const [hasReasons, setHasReasons] = useState(false);

  useEffect(() => {
    myDataStatus().then(setStatus, () => setStatus({ connected: false, ref: null }));
    try {
      const has = Boolean(localStorage.getItem(REASONS_STORE));
      setTimeout(() => setHasReasons(has), 0);
    } catch {
      // Storage blocked: nothing saved on this device.
    }
  }, []);

  const clearReasons = () => {
    try {
      localStorage.removeItem(REASONS_STORE);
    } catch {}
    setHasReasons(false);
  };

  if (!status) return <p className="text-text-2">Checking this browser…</p>;

  return (
    <div className="flex flex-col gap-4">
      {step === "deleted" ? (
        <p role="status" className="rounded-2xl bg-sage-soft px-4 py-3.5 text-text-on-sage">
          <strong className="font-semibold">Deleted.</strong> Your check-in, answers, messages and contact details have been removed
          from our records, and this browser no longer holds a check-in.
        </p>
      ) : step === "held" ? (
        <div role="status" className="flex flex-col gap-2 rounded-2xl bg-sky px-4 py-3.5 text-text-2">
          <p>
            <strong className="font-semibold text-ink">We&apos;ve recorded your request.</strong> Because you told us you might not be
            safe, your care team needs to keep this check-in until they have been in touch with you. It will be deleted after that.
          </p>
          <p>
            If you need help now, use <Link href="/help-now">I need help now</Link>.
          </p>
        </div>
      ) : !status.connected ? (
        <p className="rounded-2xl bg-surface px-4 py-3.5 text-text-2">This prototype isn&apos;t connected to a database, so nothing is stored.</p>
      ) : !status.ref ? (
        <p className="rounded-2xl bg-surface px-4 py-3.5 text-text-2">
          This browser doesn&apos;t hold a check-in, so there is nothing to delete here. If you did a check-in on another device or
          already closed the browser, <Link href="/talk">ask the care team</Link> and they will delete it for you.
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
          <p className="text-text-2">
            Your check-in reference: <strong className="font-semibold text-ink tabular-nums">{status.ref}</strong>
          </p>
          {step === "confirm" || step === "working" ? (
            <>
              <p className="font-semibold">Delete everything from this check-in? This can&apos;t be undone.</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={step === "working"}
                  onClick={async () => {
                    setStep("working");
                    const r = await deleteMyData().catch(() => ({ result: "error" as const }));
                    setStep(r.result === "deleted" || r.result === "none" ? "deleted" : r.result === "held" ? "held" : "error");
                  }}
                  className="min-h-12 cursor-pointer rounded-full bg-ink px-5 font-medium text-white disabled:cursor-wait disabled:opacity-70"
                >
                  {step === "working" ? "Deleting…" : "Yes, delete everything"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("idle")}
                  className="min-h-12 cursor-pointer rounded-full border-[1.5px] border-ink px-5 font-medium"
                >
                  Keep my check-in
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setStep("confirm")}
              className="min-h-12 cursor-pointer self-start rounded-full border-[1.5px] border-ink px-5 font-medium"
            >
              Delete my data
            </button>
          )}
          {step === "error" && (
            <p role="alert" className="text-caption text-danger">
              That didn&apos;t work. Please try again in a moment.
            </p>
          )}
        </div>
      )}

      {hasReasons && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
          <p className="text-text-2">
            Your &ldquo;My reasons&rdquo; notes are saved on this device only. We never see them.
          </p>
          <button
            type="button"
            onClick={clearReasons}
            className="min-h-11 cursor-pointer self-start text-caption text-primary-dark underline underline-offset-2"
          >
            Delete my notes from this device
          </button>
        </div>
      )}
    </div>
  );
}
