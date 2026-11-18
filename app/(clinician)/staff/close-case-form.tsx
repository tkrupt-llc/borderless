"use client";

import { useState, useTransition } from "react";
import { closeCase } from "./actions";
import { canCloseCase, CLOSURE_REASONS, CLOSURE_STEPS, type ClosureReason, type ClosureState, type ClosureStep } from "@/lib/staff/safety-rules";

/**
 * Close case: a reason is required, the summary must be signed, and every step
 * must be done or marked "not needed". Blocked while a safety flag is open or an
 * urgent hand-off is stalled. The same rules run again on the server.
 */
export function CloseCaseForm({ sessionId, state }: { sessionId: string; state: ClosureState }) {
  const [reason, setReason] = useState<ClosureReason | null>(null);
  const [notNeeded, setNotNeeded] = useState<ClosureStep[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const verdict = canCloseCase(state, reason, notNeeded);

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[0.875rem] font-semibold">Closure reason</legend>
        {(Object.entries(CLOSURE_REASONS) as [ClosureReason, string][]).map(([id, label]) => (
          <label key={id} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[0.875rem]">
            <input type="radio" name={`close-${sessionId}`} checked={reason === id} onChange={() => setReason(id)} className="size-4 accent-primary" />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <span className="text-[0.875rem] font-semibold">Before closing</span>
        <span className={`text-[0.875rem] ${state.summarySigned ? "text-text-2" : "text-danger"}`}>
          {state.summarySigned ? "✓ Summary signed" : "✗ Summary not signed yet"}
        </span>
        {(Object.entries(CLOSURE_STEPS) as [ClosureStep, string][]).map(([id, label]) =>
          state.steps[id] ? (
            <span key={id} className="text-[0.875rem] text-text-2">
              ✓ {label}
            </span>
          ) : (
            <label key={id} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[0.875rem]">
              <input
                type="checkbox"
                checked={notNeeded.includes(id)}
                onChange={(e) => setNotNeeded((n) => (e.target.checked ? [...n, id] : n.filter((x) => x !== id)))}
                className="size-4 accent-primary"
              />
              {label}: not needed
            </label>
          ),
        )}
        {state.openSafetyFlags > 0 && <span className="text-[0.875rem] text-danger">✗ A safety flag is still open</span>}
        {state.urgentHandoffStalled && <span className="text-[0.875rem] text-danger">✗ An urgent hand-off is stalled</span>}
        {state.hadCrisis && (
          <span className="text-[0.8125rem] text-muted">This case had a crisis: check-ins at 7 and 30 days will be scheduled on closing.</span>
        )}
      </div>

      <button
        type="button"
        disabled={!verdict.ok || pending}
        onClick={() =>
          start(async () => {
            const r = await closeCase({ sessionId, reason, notNeeded }).catch(() => ({ ok: false as const, error: "That didn't save." }));
            setMsg(r.ok ? "Case closed." : "error" in r ? r.error : "That didn't save.");
          })
        }
        className="min-h-10 cursor-pointer self-start rounded-full bg-primary px-4 text-[0.875rem] font-semibold text-white disabled:cursor-default disabled:opacity-45"
      >
        {pending ? "Closing…" : "Close case"}
      </button>
      {!verdict.ok && reason && <p className="text-[0.8125rem] text-text-2">To close: {verdict.blockers.join("; ")}.</p>}
      <p role="status" className="text-[0.8125rem] text-text-2">
        {msg}
      </p>
    </div>
  );
}
