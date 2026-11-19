"use client";

import { useState, useTransition } from "react";
import { closeTask } from "./actions";

/**
 * Closing a red-flag task: allowed after a logged conversation with the
 * person; otherwise only the duty supervisor can sign it off, with a reason.
 */
export function CloseRedFlag({ taskId, spokeLogged, isSupervisor }: { taskId: string; spokeLogged: boolean; isSupervisor: boolean }) {
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const close = (signOff?: string) =>
    start(async () => {
      const r = await closeTask(taskId, signOff).catch(() => ({ ok: false as const, error: "That didn't save." }));
      setMsg(r.ok ? "Closed." : "error" in r ? r.error : "That didn't save.");
    });
  const btn = "min-h-9 cursor-pointer rounded-full border border-line bg-surface px-3 text-[0.875rem] font-medium disabled:cursor-default disabled:opacity-45";

  if (spokeLogged) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} onClick={() => close()} className={btn}>
          Close task
        </button>
        <span role="status" className="text-[0.8125rem] text-text-2">{msg}</span>
      </span>
    );
  }
  if (!isSupervisor) {
    return <span className="text-[0.8125rem] text-muted">To close this red flag, log a conversation with the person, or ask the duty supervisor to sign it off.</span>;
  }
  return (
    <span className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1 text-[0.8125rem] text-text-2">
        Supervisor sign-off reason (no conversation logged)
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="min-h-9 rounded-lg border border-line bg-surface px-2.5 text-[0.875rem]" />
      </label>
      <button type="button" disabled={pending || reason.trim().length < 5} onClick={() => close(reason)} className={btn}>
        Sign off and close
      </button>
      <span role="status" className="basis-full text-[0.8125rem] text-text-2">{msg}</span>
    </span>
  );
}
