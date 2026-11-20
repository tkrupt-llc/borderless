"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CallbackForm } from "./callback-form";
import { sendCareTeamMessage } from "./actions";
import { PhoneIcon } from "@/components/icons";
import en from "@/content/i18n/en.json";

type View = "menu" | "call" | "msg" | "sent" | "flag";

const option =
  "tap flex w-full cursor-pointer items-center gap-3.5 rounded-[18px] bg-surface p-4 text-left text-ink no-underline hover:text-ink";
const iconWrap = "flex size-11 shrink-0 items-center justify-center rounded-full bg-sky";
const back = "min-h-11 cursor-pointer self-center text-caption font-medium text-primary-dark";

/** The three ways to reach a person, and the message flow (design canvas, Talk to someone). */
export function TalkOptions() {
  const [view, setView] = useState<View>("menu");
  const [msg, setMsg] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [alerted, setAlerted] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function send() {
    setError("");
    start(async () => {
      const r = await sendCareTeamMessage({ body: msg }).catch(() => ({
        ok: false as const,
        reason: "error" as const,
        flagged: false,
      }));
      // A risk phrase shows the emergency options whether or not saving worked.
      if (r.flagged) {
        setAlerted(r.ok);
        setView("flag");
        return;
      }
      if (!r.ok) return setError("That didn't send. Please try again, or request a call back.");
      setRef(r.ref);
      setMsg("");
      setView("sent");
    });
  }

  if (view === "flag") {
    return (
      <div role="alert" className="flex flex-col gap-2.5 rounded-[18px] border-2 border-danger bg-surface p-[18px]">
        <strong className="font-serif text-[1.375rem] leading-snug font-medium">Thank you for telling us. Your safety comes first.</strong>
        <p className="text-text-2">
          {alerted
            ? "What you wrote sounds like you might not be safe. We've alerted the on-call clinician now."
            : "What you wrote sounds like you might not be safe."}{" "}
          {en.emergency.card}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <a href="tel:998" className="flex min-h-12 items-center justify-center rounded-[14px] bg-danger font-semibold text-white no-underline hover:text-white">
            Call 998 · Ambulance
          </a>
          <a href="tel:999" className="flex min-h-12 items-center justify-center rounded-[14px] bg-danger font-semibold text-white no-underline hover:text-white">
            Call 999 · Police
          </a>
        </div>
        <Link href="/help-now" className="inline-flex min-h-11 items-center font-semibold text-ink">
          More help options →
        </Link>
      </div>
    );
  }

  if (view === "sent") {
    return (
      <div role="status" className="anim-pop flex flex-col gap-2 rounded-[18px] bg-sky p-[18px]">
        <span className="text-[0.75rem] font-semibold tracking-[0.06em] text-blue uppercase">Sent</span>
        <strong className="text-[1.0625rem] font-semibold">Message sent{ref ? ` · ${ref}` : ""}</strong>
        <span className="text-blue-ink">Your care team will read it, usually within 1 working day. Their reply appears on your timeline.</span>
        <Link href="/check/done/current" className="inline-flex min-h-11 items-center font-semibold text-blue">
          See your timeline →
        </Link>
      </div>
    );
  }

  if (view === "call") {
    return (
      <div className="anim-pop flex flex-col gap-3 rounded-[18px] bg-surface p-4">
        <strong className="font-semibold">Request a call back</strong>
        <CallbackForm />
        <button type="button" onClick={() => setView("menu")} className={back}>
          Back
        </button>
      </div>
    );
  }

  if (view === "msg") {
    return (
      <div className="anim-pop flex flex-col gap-2.5 rounded-[18px] bg-surface p-4">
        <label htmlFor="care-msg" className="font-semibold">
          Your message
        </label>
        <textarea
          id="care-msg"
          rows={4}
          maxLength={1000}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Write as much or as little as you like"
          className="resize-y rounded-xl border-[1.5px] border-line px-3 py-2.5"
        />
        <p className="text-[0.8125rem] text-muted">Read by your care team, usually within 1 working day. Not for emergencies.</p>
        <button
          type="button"
          onClick={send}
          disabled={msg.trim().length < 2 || pending}
          className="tap flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-primary font-semibold text-white disabled:cursor-default disabled:opacity-45"
        >
          {pending ? "Sending…" : "Send message"}
        </button>
        {error && (
          <p role="status" className="text-caption text-danger">
            {error}
          </p>
        )}
        <button type="button" onClick={() => setView("menu")} className={back}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="anim-pop anim-delay-1 flex flex-col gap-2.5">
      <button type="button" onClick={() => setView("call")} className={option}>
        <span className={iconWrap}>
          <PhoneIcon color="var(--blue)" />
        </span>
        <span className="flex flex-col">
          <strong className="font-semibold">Request a call back</strong>
          <span className="text-caption text-muted">Someone from your care team calls you, within one working day</span>
        </span>
      </button>
      <button type="button" onClick={() => setView("msg")} className={option}>
        <span className={iconWrap}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="flex flex-col">
          <strong className="font-semibold">Send a message to your care team</strong>
          <span className="text-caption text-muted">The reply appears on your timeline</span>
        </span>
      </button>
      {/* Support line, not an emergency service, so not red. */}
      <a href="tel:800725462" className={option}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sage">
          <PhoneIcon color="var(--primary-dark)" />
        </span>
        <span className="flex flex-col">
          <strong className="font-semibold">Talk to someone right now</strong>
          <span className="text-caption text-muted">Call 800-SAKINA · 800 725462 · 24/7 support</span>
        </span>
      </a>
    </div>
  );
}
