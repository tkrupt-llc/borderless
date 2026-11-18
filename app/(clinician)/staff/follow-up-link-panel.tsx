"use client";

import { useState, useTransition } from "react";
import { logFollowUpLinkSent } from "./actions";

const CHANNELS = [
  ["sms", "SMS"],
  ["whatsapp", "WhatsApp"],
  ["email", "Email"],
  ["phone", "Read out on a call"],
  ["in_person", "In person"],
] as const;

/**
 * The person's private follow-up link. The clinician copies it, sends it
 * themselves, and logs that they did. Automatic sending is a pilot step.
 */
export function FollowUpLinkPanel({ sessionId, link, sentCount }: { sessionId: string; link: string; sentCount: number }) {
  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-2 text-[0.875rem]">
      <div className="flex flex-wrap items-center gap-2">
        <input readOnly value={link} aria-label="Follow-up link" onFocus={(e) => e.target.select()} className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[0.8125rem]" />
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(link).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
          className="min-h-10 cursor-pointer rounded-full border border-line bg-surface px-3.5 font-medium"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[0.8125rem] text-text-2">
          Sent by
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="min-h-10 rounded-lg border border-line bg-surface px-2.5">
            <option value="">Choose…</option>
            {CHANNELS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!channel || pending}
          onClick={() =>
            start(async () => {
              const r = await logFollowUpLinkSent(sessionId, channel).catch(() => ({ ok: false as const }));
              setMsg(r.ok ? "Logged: link sent." : "That didn't save.");
            })
          }
          className="min-h-10 cursor-pointer rounded-full bg-primary px-4 font-semibold text-white disabled:cursor-default disabled:opacity-45"
        >
          Log link sent
        </button>
      </div>
      <p role="status" className="text-[0.8125rem] text-text-2">
        {msg || (sentCount > 0 ? `Sent ${sentCount} ${sentCount === 1 ? "time" : "times"} so far.` : "Not sent yet.")}
      </p>
      <p className="text-[0.75rem] text-muted">Automatic sending by SMS or email is a pilot step; for now, send it yourself and log it.</p>
    </div>
  );
}
