"use client";

import { useState, useTransition } from "react";
import { replyToPatient } from "./actions";

// Starting points the clinician edits before sending. Neutral wording: the
// message may be seen by someone else on the person's phone.
const TEMPLATES = [
  { label: "I'll call you today", text: "I've read your answers. I'll call you today at one of the times you chose." },
  { label: "Next step agreed", text: "Thank you for checking in. I've agreed your next step, and you can see it on your timeline." },
  { label: "Thanks for your message", text: "Thank you for your message. I've read it and I'll be in touch soon." },
];

/** "Reply to patient": the message shows on the person's receipt timeline. */
export function ReplyBox({ sessionId }: { sessionId: string }) {
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-2 border-t border-line-warm pt-3">
      <label htmlFor="reply-msg" className="text-[0.875rem] font-semibold">
        Reply to patient
      </label>
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setMsg(t.text)}
            className="min-h-9 cursor-pointer rounded-full border border-line bg-surface px-3 text-[0.8125rem]"
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        id="reply-msg"
        rows={3}
        maxLength={1000}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        className="resize-y rounded-lg border border-line bg-surface px-2.5 py-2 text-[0.875rem]"
      />
      <p className="text-[0.75rem] text-muted">Shows on the patient&apos;s timeline. Keep it neutral: someone else may see their phone.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={msg.trim().length < 3 || pending}
          onClick={() =>
            start(async () => {
              const r = await replyToPatient(sessionId, msg).catch(() => ({ ok: false as const, error: "That didn't send. Please try again." }));
              if (!r.ok) return setStatus("error" in r ? r.error : "That didn't send.");
              setMsg("");
              setStatus("Sent. The patient sees it on their timeline.");
            })
          }
          className="min-h-10 cursor-pointer rounded-full bg-primary px-4 text-[0.875rem] font-semibold text-white disabled:cursor-default disabled:opacity-45"
        >
          {pending ? "Sending…" : "Send reply"}
        </button>
        <p role="status" className="text-[0.8125rem] text-text-2">
          {status}
        </p>
      </div>
    </div>
  );
}
