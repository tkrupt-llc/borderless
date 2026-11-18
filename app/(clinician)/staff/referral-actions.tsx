"use client";

import { useState, useTransition } from "react";
import { updateReferral } from "./actions";

const btn = "min-h-10 cursor-pointer rounded-full border border-line bg-surface px-3.5 text-[0.875rem] font-medium text-ink disabled:cursor-wait";
const primary = "min-h-10 cursor-pointer rounded-full bg-primary px-4 text-[0.875rem] font-semibold text-white disabled:cursor-default disabled:opacity-45";

/** Clinician steps on an open hand-off: booked (with date) -> first contact -> closed. Each is audited. */
export function ReferralActions({ sessionId, status }: { sessionId: string; status: string }) {
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const run = (step: "booked" | "first_contact" | "closed", done: string) =>
    start(async () => {
      const r = await updateReferral(sessionId, step, step === "booked" ? date : undefined).catch(() => ({ ok: false as const, error: "That didn't save." }));
      setMsg(r.ok ? done : "error" in r ? r.error : "That didn't save.");
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        {status === "referred" && (
          <>
            <label className="flex flex-col gap-1 text-[0.8125rem] text-text-2">
              Appointment date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-10 rounded-lg border border-line bg-surface px-2.5 text-[0.875rem]" />
            </label>
            <button type="button" disabled={!date || pending} onClick={() => run("booked", "Marked booked. The patient's card shows the date.")} className={primary}>
              Mark booked
            </button>
          </>
        )}
        {(status === "referred" || status === "booked") && (
          <button type="button" disabled={pending} onClick={() => run("first_contact", "First contact confirmed.")} className={btn}>
            First contact confirmed
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => run("closed", "Hand-off closed.")} className={btn}>
          Close hand-off
        </button>
      </div>
      <p role="status" className="text-[0.8125rem] text-text-2">
        {msg}
      </p>
    </div>
  );
}
