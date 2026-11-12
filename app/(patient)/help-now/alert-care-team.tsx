"use client";

import { useEffect, useState, useTransition } from "react";
import { alertCareTeam, helpNowOpened, type AlertResult } from "./actions";
import { isDiscreet } from "@/lib/discreet";

// The call buttons above never wait on this: everything here is optional and after them.
export function AlertCareTeam() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AlertResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Opening this page during a check-in tells the care team (RF-HELP-NOW).
  useEffect(() => {
    void helpNowOpened();
  }, []);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setResult(
          await alertCareTeam({
            phone: String(form.get("phone") ?? ""),
            callbackTime: String(form.get("callbackTime") ?? ""),
            discreet: isDiscreet(),
          }),
        );
      } catch {
        setResult({ ok: false, reason: "error" });
      }
    });
  }

  if (result?.ok) {
    return (
      <p role="status" className="rounded-2xl bg-sage px-4 py-3.5 text-text-on-sage">
        <strong className="font-semibold text-ink">Your care team has been told.</strong> A clinician will call you.
        If you are in danger now, call 998 or 999.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[60px] cursor-pointer items-center gap-3.5 rounded-2xl border-[1.5px] border-ink bg-surface px-[18px] text-left text-ink"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
          <path
            d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="flex flex-col">
          <strong className="font-semibold">Alert my care team now</strong>
          <span className="text-small text-muted">The on-call clinician is told straight away</span>
        </span>
      </button>

      {open && (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-4">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Your phone number</span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              inputMode="tel"
              className="min-h-12 rounded-xl border-[1.5px] border-line bg-bg px-3 text-body"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">
              Best time to call <span className="font-normal text-muted">(optional)</span>
            </span>
            <input
              name="callbackTime"
              type="text"
              maxLength={80}
              placeholder="For example: now, or after 6 pm"
              className="min-h-12 rounded-xl border-[1.5px] border-line bg-bg px-3 text-body"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-ink px-6 font-semibold text-white disabled:cursor-wait"
          >
            {pending ? "Sending…" : "Alert my care team"}
          </button>
          <p role="status" className="text-caption text-text-2">
            {result?.ok === false &&
              (result.reason === "invalid"
                ? "Please check the phone number."
                : result.reason === "not_connected"
                  ? "This prototype is not connected to a care team yet. If you are in danger, please call 998 or 999 now."
                  : "That didn't send. Please try again, or call 998 or 999 now.")}
          </p>
        </form>
      )}
    </div>
  );
}
