"use client";

import { useState, useTransition } from "react";
import { logPatientNotification, sendNewReturnCode } from "./actions";
import { CHANNEL_LABELS, type Channel } from "@/lib/contact/messages";

const btn = "min-h-10 cursor-pointer rounded-full border border-line bg-surface px-3.5 text-[0.875rem] font-medium disabled:cursor-default disabled:opacity-45";
const primary = "min-h-10 cursor-pointer rounded-full bg-primary px-4 text-[0.875rem] font-semibold text-white disabled:cursor-default disabled:opacity-45";

/**
 * Copy a discreet message (no health words) for the channel the person chose,
 * send it yourself, then log it. Same pattern as the follow-up link.
 */
export function DiscreetMessage({
  sessionId,
  kind,
  messages,
  defaultChannel,
  taskId,
  sentCount,
}: {
  sessionId: string;
  kind: string;
  /** One message per allowed channel. */
  messages: Partial<Record<Channel, string>>;
  defaultChannel: Channel | null;
  taskId?: string;
  sentCount: number;
}) {
  const channels = Object.keys(messages) as Channel[];
  const [channel, setChannel] = useState<Channel | "">(defaultChannel && channels.includes(defaultChannel) ? defaultChannel : (channels[0] ?? ""));
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  if (channels.length === 0) {
    return <p className="text-[0.8125rem] text-muted">No contact channel shared and allowed, so there&apos;s nothing to send. They can read replies on their timeline with their reference and code.</p>;
  }
  const text = channel ? messages[channel] ?? "" : "";

  return (
    <div className="flex flex-col gap-2 text-[0.875rem]">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[0.8125rem] text-text-2">
          Channel
          <select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value as Channel);
              setCopied(false);
            }}
            className="min-h-10 rounded-lg border border-line bg-surface px-2.5"
          >
            {channels.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => setCopied(false))}
          className={btn}
        >
          {copied ? "Copied" : "Copy discreet message"}
        </button>
        <button
          type="button"
          disabled={!channel || pending}
          onClick={() =>
            start(async () => {
              const r = await logPatientNotification(sessionId, kind, channel, taskId).catch(() => ({ ok: false as const }));
              setMsg(r.ok ? "Logged: message sent." : "That didn't save.");
            })
          }
          className={primary}
        >
          Log message sent
        </button>
      </div>
      <textarea readOnly value={text} rows={3} aria-label="Discreet message" className="resize-y rounded-lg border border-line bg-sage-mist px-2.5 py-2 text-[0.8125rem]" />
      <p role="status" className="text-[0.8125rem] text-text-2">
        {msg || (sentCount > 0 ? `Sent ${sentCount} ${sentCount === 1 ? "time" : "times"} so far.` : "Not sent yet.")} No health words: safe if someone else sees their phone.
      </p>
    </div>
  );
}

/**
 * "Send new return code": only via a channel the person shared and allows.
 * The code is never shown here; the message goes straight to the clipboard.
 */
export function SendNewReturnCode({ sessionId, channels, origin }: { sessionId: string; channels: Channel[]; origin: string }) {
  const options = channels.filter((c): c is "sms" | "whatsapp" | "email" => c === "sms" || c === "whatsapp" || c === "email");
  const [channel, setChannel] = useState(options[0] ?? "");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  if (options.length === 0) {
    return <p className="text-[0.8125rem] text-muted">A new return code can only be sent by SMS, WhatsApp or email the person shared and allowed.</p>;
  }
  return (
    <div className="flex flex-wrap items-end gap-2 text-[0.875rem]">
      <label className="flex flex-col gap-1 text-[0.8125rem] text-text-2">
        Send by
        <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className="min-h-10 rounded-lg border border-line bg-surface px-2.5">
          {options.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await sendNewReturnCode(sessionId, channel, origin).catch(() => ({ ok: false as const, error: "That didn't work." }));
            if (!r.ok) return setMsg(r.error);
            try {
              await navigator.clipboard.writeText(r.message);
              setMsg("New code created and its message copied. Paste it into the patient's chosen channel and send it. The old code no longer works.");
            } catch {
              setMsg("New code created, but copying failed. Create another code and try again.");
            }
          })
        }
        className={btn}
      >
        {pending ? "Creating…" : "Send new return code"}
      </button>
      <p role="status" className="basis-full text-[0.8125rem] text-text-2">
        {msg || "The code isn't shown on screen. Creating a new one stops the old one working."}
      </p>
    </div>
  );
}
