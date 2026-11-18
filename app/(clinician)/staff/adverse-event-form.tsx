"use client";

import { useState, useTransition } from "react";
import { reportAdverseEvent } from "./actions";

const CATEGORIES = [
  ["self_harm", "Self-harm"],
  ["harm_to_others", "Harm to others"],
  ["missed_urgent_contact", "Missed urgent contact"],
  ["care_delay", "Delay in care"],
  ["privacy", "Privacy incident"],
  ["other", "Other"],
] as const;
const SEVERITIES = [
  ["low", "Low"],
  ["moderate", "Moderate"],
  ["severe", "Severe"],
] as const;

const field = "min-h-10 rounded-lg border border-line bg-surface px-2.5 text-[0.875rem]";

/** "Report adverse event": counted on the service overview and written to the audit trail. */
export function AdverseEventForm({ sessionId = null }: { sessionId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setStatus("");
          }}
          className="min-h-10 cursor-pointer rounded-full border border-line bg-surface px-3.5 text-[0.875rem] font-medium text-ink"
        >
          Report adverse event
        </button>
        <p role="status" className="text-[0.8125rem] text-text-2">
          {status}
        </p>
      </div>
    );
  }

  const ready = category && severity && description.trim().length >= 5;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await reportAdverseEvent({ sessionId, category, severity, description }).catch(() => ({ ok: false as const, error: "That didn't save." }));
          if (!r.ok) return setStatus("error" in r ? r.error : "That didn't save.");
          setOpen(false);
          setCategory("");
          setSeverity("");
          setDescription("");
          setStatus("Adverse event reported and logged to the audit trail.");
        });
      }}
      className="anim-pop flex flex-col gap-2 rounded-xl border border-line bg-sage-mist p-3"
    >
      <strong>Report adverse event</strong>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-[0.8125rem] text-text-2">
          Type
          <select required value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            <option value="">Choose…</option>
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8125rem] text-text-2">
          Severity
          <select required value={severity} onChange={(e) => setSeverity(e.target.value)} className={field}>
            <option value="">Choose…</option>
            {SEVERITIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[0.8125rem] text-text-2">
        What happened (no names)
        <textarea required rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={`${field} py-2`} />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!ready || pending}
          className="min-h-10 cursor-pointer rounded-full bg-primary px-4 text-[0.875rem] font-semibold text-white disabled:cursor-default disabled:opacity-45"
        >
          {pending ? "Saving…" : "Submit report"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 cursor-pointer rounded-full border border-line bg-surface px-3.5 text-[0.875rem]">
          Cancel
        </button>
      </div>
      {status && <p role="status" className="text-[0.8125rem] text-danger">{status}</p>}
    </form>
  );
}
