"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeUrgency, markReviewed, replyToPatient } from "./actions";

const LEVELS = [
  { id: "imminent", label: "Imminent" },
  { id: "urgent", label: "Urgent" },
  { id: "elevated", label: "Elevated" },
  { id: "normal", label: "Routine" },
] as const;

// Starting points the clinician edits before sending (design canvas templates).
const TEMPLATES = [
  { label: "I'll call you today", text: "I've read your answers. I'll call you today before 6 pm." },
  { label: "Counsellor will contact", text: "Thank you for checking in. A counsellor will contact you within 2 working days." },
  { label: "Well done", text: "Your scores are improving. Keep using the coping cards, and we'll check in again in 4 weeks." },
];

const outline = "tap min-h-11 cursor-pointer rounded-full border-[1.5px] border-primary bg-surface px-4 text-[0.875rem] font-semibold text-primary";
const quiet = "tap min-h-10 cursor-pointer rounded-full border border-line bg-surface px-3.5 text-[0.875rem] font-medium text-ink";
const solid = "tap min-h-10 cursor-pointer rounded-full bg-primary px-4 text-[0.875rem] font-semibold text-white disabled:cursor-default disabled:opacity-45";

/**
 * The pinned action bar under a case: call, reply (shows on the patient's
 * timeline), change urgency (reason required, logged), mark reviewed and open
 * the next most urgent case.
 */
export function ActionBar({
  sessionId,
  refLabel,
  write,
  phone,
  priority,
  nextHref,
}: {
  sessionId: string;
  refLabel: string;
  write: boolean;
  phone: string | null;
  priority: string;
  nextHref: string;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<"none" | "reply" | "urgency">("none");
  const [msg, setMsg] = useState("");
  const [level, setLevel] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string, after?: () => void) =>
    start(async () => {
      const r = await fn().catch(() => ({ ok: false, error: "That didn't save. Please try again." }));
      if (!r.ok) return setToast("error" in r && r.error ? r.error : "That didn't save. Please try again.");
      setPanel("none");
      setToast(done);
      after?.();
      router.refresh();
    });

  const imminent = priority === "imminent";
  const cantSave = !level || level === priority || reason.trim().length < 5;

  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-2.5 border-t border-line-warm bg-surface px-6 py-3">
      {panel === "urgency" && (
        <div className="anim-pop flex flex-col gap-2 rounded-xl border border-line bg-sage-mist p-3">
          <strong>Change urgency</strong>
          <div role="radiogroup" aria-label="New urgency" className="flex flex-wrap gap-1.5">
            {LEVELS.map((l) => {
              const on = (level ?? priority) === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setLevel(l.id)}
                  className={`min-h-9 cursor-pointer rounded-full px-3 text-[0.8125rem] font-medium ${
                    on ? "border border-primary bg-primary text-white" : "border border-line bg-surface text-ink"
                  }`}
                >
                  {l.label}
                  {l.id === priority && " (now)"}
                </button>
              );
            })}
          </div>
          <label htmlFor="urgency-reason" className="text-[0.8125rem] text-text-2">
            Reason (required, saved to the audit trail)
          </label>
          <input
            id="urgency-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="e.g. Spoke to patient, has a safety plan and support at home"
            className="min-h-10 rounded-lg border border-line bg-surface px-2.5 text-[0.875rem]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={cantSave || pending}
              onClick={() => run(() => changeUrgency(sessionId, level!, reason), "Urgency changed and logged to the audit trail.", () => {
                setLevel(null);
                setReason("");
              })}
              className={solid}
            >
              {pending ? "Saving…" : "Save change"}
            </button>
            <button type="button" onClick={() => setPanel("none")} className={quiet}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {panel === "reply" && (
        <div className="anim-pop flex flex-col gap-2 rounded-xl border border-line bg-sage-mist p-3">
          <strong>Reply to {refLabel}</strong>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button key={t.label} type="button" onClick={() => setMsg(t.text)} className="min-h-9 cursor-pointer rounded-full border border-line bg-surface px-3 text-[0.8125rem]">
                {t.label}
              </button>
            ))}
          </div>
          <label htmlFor="reply-msg" className="text-[0.8125rem] text-text-2">
            Message (shows on the patient&apos;s timeline)
          </label>
          <textarea
            id="reply-msg"
            rows={2}
            value={msg}
            maxLength={1000}
            onChange={(e) => setMsg(e.target.value)}
            className="resize-y rounded-lg border border-line bg-surface px-2.5 py-2 text-[0.875rem]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={msg.trim().length < 3 || pending}
              onClick={() => run(() => replyToPatient(sessionId, msg), "Sent. The patient sees it on their timeline.", () => setMsg(""))}
              className={solid}
            >
              {pending ? "Sending…" : "Send"}
            </button>
            <button type="button" onClick={() => setPanel("none")} className={quiet}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && (
        <p role="status" className="anim-pop rounded-lg bg-sky px-3 py-2 text-[0.8125rem] text-text-on-sage">
          {toast}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {phone ? (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className={`tap inline-flex min-h-11 items-center rounded-full px-[18px] text-[0.875rem] font-semibold text-white no-underline hover:text-white ${imminent ? "bg-danger" : "bg-primary"}`}
          >
            Call patient
          </a>
        ) : (
          <span className="inline-flex min-h-11 items-center rounded-full bg-sage-soft px-[18px] text-[0.875rem] text-muted">No phone shared</span>
        )}
        {write ? (
          <>
            <button type="button" onClick={() => { setPanel(panel === "reply" ? "none" : "reply"); setToast(""); }} className={outline} aria-expanded={panel === "reply"}>
              Reply to patient
            </button>
            <button type="button" onClick={() => { setPanel(panel === "urgency" ? "none" : "urgency"); setToast(""); }} className={outline} aria-expanded={panel === "urgency"}>
              Change urgency
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markReviewed(sessionId), "Marked reviewed. Opened the next most urgent case.", () => router.push(nextHref))}
              className={`${quiet} ms-auto min-h-11 px-4`}
            >
              Mark reviewed · next case
            </button>
          </>
        ) : (
          <span className="inline-flex min-h-11 items-center text-[0.8125rem] text-muted">View only</span>
        )}
      </div>
    </div>
  );
}
