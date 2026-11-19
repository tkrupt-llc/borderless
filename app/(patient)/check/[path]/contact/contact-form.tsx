"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveContactPreferences } from "../../actions";

const METHODS = [
  { id: "phone", label: "Phone call" },
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
] as const;
const TIMES = [
  { id: "weekday_mornings", label: "Weekday mornings" },
  { id: "weekday_evenings", label: "Weekday evenings" },
  { id: "weekends", label: "Weekends" },
  { id: "any_time", label: "Any time" },
] as const;
type Method = (typeof METHODS)[number]["id"];

const chip = (on: boolean) =>
  `tap min-h-11 cursor-pointer rounded-full border-[1.5px] px-4 text-caption font-medium ${
    on ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:border-primary"
  }`;

/** What a message from us looks like: nothing about mental health, in case someone else sees the phone. */
function preview(method: Method | null, leave: boolean | null): string {
  if (!method) return "Choose a way to reach you to see an example.";
  if (method === "phone")
    return leave
      ? "“Hello, this is your care team returning your message. Please call us back.”"
      : "We won't leave a voicemail. We'll try again at your next safe time.";
  return "“You have a new message from your care team. Open the link to read it.”";
}

export function ContactForm() {
  const { path } = useParams<{ path: string }>();
  const router = useRouter();
  const [method, setMethod] = useState<Method | null>(null);
  const [address, setAddress] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [leave, setLeave] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const resultHref = `/check/${path}/result`;
  const isEmail = method === "email";

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!method) return setError("Choose a way to reach you, or tap Not now.");
    start(async () => {
      const r = await saveContactPreferences({ method, address, times, leaveMessage: method === "phone" ? leave : null }).catch(() => ({
        ok: false as const,
        reason: "error" as const,
      }));
      if (r.ok) router.push(resultHref);
      else setError(r.reason === "invalid" ? (isEmail ? "Please check the email address." : "Please check the phone number.") : "That didn't save. Please try again.");
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5 px-5 pt-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Best way to reach you</legend>
        <div role="radiogroup" aria-label="Best way to reach you" className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)} className={chip(method === m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        {method && (
          <label className="anim-pop mt-1 flex flex-col gap-1">
            <span className="text-caption text-text-2">{isEmail ? "Your email address" : "Your phone number"}</span>
            <input
              key={isEmail ? "email" : "tel"}
              type={isEmail ? "email" : "tel"}
              inputMode={isEmail ? "email" : "tel"}
              autoComplete={isEmail ? "email" : "tel"}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="min-h-12 rounded-xl border-[1.5px] border-line bg-surface px-3.5"
            />
          </label>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Safe times to contact you</legend>
        <div className="flex flex-wrap gap-2">
          {TIMES.map((t) => {
            const on = times.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => setTimes((cur) => (on ? cur.filter((x) => x !== t.id) : [...cur, t.id]))}
                className={chip(on)}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {method === "phone" && (
        <fieldset className="anim-pop flex flex-col gap-2">
          <legend className="mb-2 font-semibold">Is it OK to leave a message if you don&apos;t answer?</legend>
          <div role="radiogroup" aria-label="Leave a message" className="flex flex-wrap gap-2">
            {[
              [true, "Yes"],
              [false, "No"],
            ].map(([v, label]) => (
              <button key={String(v)} type="button" role="radio" aria-checked={leave === v} onClick={() => setLeave(v as boolean)} className={chip(leave === v)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="rounded-2xl bg-sky px-4 py-3.5">
        <span className="text-[0.75rem] font-semibold tracking-[0.06em] text-blue uppercase">What a message from us looks like</span>
        <p aria-live="polite" className="mt-2 rounded-[14px_14px_14px_4px] bg-surface px-3 py-2.5 text-caption text-blue-ink">
          {preview(method, leave)}
        </p>
        <p className="mt-2 text-[0.8125rem] text-blue-ink">No mention of mental health, so it&apos;s private if someone else sees your phone.</p>
      </div>

      <div className="flex flex-col gap-1">
        <button
          type="submit"
          disabled={pending}
          className="tap flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-primary font-semibold text-white disabled:cursor-wait disabled:opacity-80"
        >
          {pending ? "Saving…" : "Save and see my results"}
        </button>
        <Link href={resultHref} className="flex min-h-11 items-center justify-center text-caption">
          Not now
        </Link>
        {!method && (
          <p className="rounded-xl bg-sky px-3.5 py-2.5 text-caption text-blue-ink">
            Without contact details, check back with your reference and code to see replies.
          </p>
        )}
        <p role="status" className="min-h-6 text-caption text-danger">
          {error}
        </p>
      </div>
    </form>
  );
}
