"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { canTellCareTeam, tellCareTeam } from "../actions";

const secondary =
  "flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-ink px-4 text-center text-caption font-medium text-ink no-underline hover:text-ink";

/**
 * Breathing pacer: 4 seconds in, 6 out. The circle grows and shrinks over the
 * same time as the words; with "reduce motion" on, the words and count still
 * change but the circle stays still (globals.css).
 */
const IN_SECONDS = 4;
const CYCLE_SECONDS = 10; // 4 in, 6 out

export function BreathingPacer({ fill = "var(--sage-deep)", ring = "var(--sage-soft)" }: { fill?: string; ring?: string }) {
  const [running, setRunning] = useState(true);
  // One counter drives everything: the phase and the count are worked out from it.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const at = tick % CYCLE_SECONDS;
  const breathingIn = at < IN_SECONDS;
  const current = breathingIn
    ? { word: "Breathe in", seconds: IN_SECONDS, scale: 1 }
    : { word: "Breathe out", seconds: CYCLE_SECONDS - IN_SECONDS, scale: 0.6 };
  const left = breathingIn ? IN_SECONDS - at : CYCLE_SECONDS - at;
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="flex size-52 items-center justify-center rounded-full" style={{ background: ring }} aria-hidden="true">
        <div
          className="flex size-44 items-center justify-center rounded-full ease-in-out"
          style={{
            background: fill,
            transform: `scale(${running ? current.scale : 0.8})`,
            transitionProperty: "transform",
            transitionDuration: `${current.seconds}s`,
          }}
        />
      </div>
      <p className="flex flex-col items-center">
        <strong aria-live="polite" className="font-serif text-[1.5rem] font-normal">
          {running ? current.word : "Paused"}
        </strong>
        <span className="text-caption text-muted tabular-nums" aria-hidden="true">
          {running ? left : "–"}
        </span>
      </p>
      <button
        type="button"
        onClick={() => {
          setRunning((r) => !r);
          setTick(0);
        }}
        className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink bg-surface px-5 text-caption font-medium"
      >
        {running ? "Pause" : "Start again"}
      </button>
    </div>
  );
}

/** A message to send to someone trusted, ready to copy or open in a messaging app. */
export function ReachOut({ message }: { message: string }) {
  const [text, setText] = useState(message);
  const [copied, setCopied] = useState(false);
  const encoded = encodeURIComponent(text);
  return (
    <div className="flex flex-col gap-2.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold">Your message</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCopied(false);
          }}
          rows={3}
          maxLength={500}
          className="rounded-2xl border-[1.5px] border-line bg-surface px-4 py-3 text-base"
        />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer" className={secondary}>
          WhatsApp<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a href={`sms:?&body=${encoded}`} className={secondary}>
          Text message
        </a>
      </div>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false))}
        className="min-h-11 cursor-pointer self-start text-caption text-primary-dark underline underline-offset-2"
      >
        {copied ? "Copied" : "Copy the message"}
      </button>
    </div>
  );
}

/** Approved card text marks its lead words with **bold**; everything else is shown as written. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/**
 * One step per screen (approved card format), then the two endings. The
 * breathing pacer stays visible on every step of the breathing card; the
 * reach-out message appears on the step that says to send it.
 */
export function CardStepper({
  cardId,
  steps,
  pacer,
  message,
}: {
  cardId: string;
  steps: string[];
  pacer?: { fill: string; ring: string };
  message?: string;
}) {
  const [index, setIndex] = useState(0);
  const done = index >= steps.length;
  const messageStep = message ? steps.findIndex((s) => s.includes("message them")) : -1;

  return (
    <div className="flex flex-col gap-4">
      {pacer && <BreathingPacer fill={pacer.fill} ring={pacer.ring} />}

      {!done ? (
        <section aria-live="polite" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-caption text-muted">
              Step {index + 1} of {steps.length}
            </span>
            <span className="flex gap-1.5" aria-hidden="true">
              {steps.map((_, i) => (
                <span key={i} className={`h-1.5 w-6 rounded-full ${i <= index ? "bg-primary" : "bg-track"}`} />
              ))}
            </span>
          </div>
          <p key={index} className="anim-pop min-h-24 rounded-2xl bg-surface px-5 py-5 font-serif text-[1.375rem] leading-snug">
            <Rich text={steps[index]} />
          </p>
          {index === messageStep && message && <ReachOut message={message} />}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className={`${secondary} tap cursor-pointer disabled:cursor-default disabled:opacity-40`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="tap flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-primary px-4 text-caption font-semibold text-white"
            >
              {index === steps.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </section>
      ) : (
        <>
          <CardFeedback cardId={cardId} />
          <button
            type="button"
            onClick={() => setIndex(0)}
            className="min-h-11 cursor-pointer self-start text-caption text-primary-dark underline underline-offset-2"
          >
            Go through the steps again
          </button>
        </>
      )}
    </div>
  );
}

/**
 * The two approved endings: "That helped" and "This isn't helping".
 * "This isn't helping" offers "Talk to someone now" and alerts a clinician
 * (when the person has a check-in and agreed to clinician review).
 */
export function CardFeedback({ cardId }: { cardId: string }) {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const [told, setTold] = useState<"idle" | "sent" | "none">("idle");

  useEffect(() => {
    if (answer !== "no") return;
    let cancelled = false;
    (async () => {
      const can = await canTellCareTeam().catch(() => false);
      if (!can) return !cancelled && setTold("none");
      const r = await tellCareTeam(cardId).catch(() => ({ ok: false }));
      if (!cancelled) setTold(r.ok ? "sent" : "none");
    })();
    return () => {
      cancelled = true;
    };
  }, [answer, cardId]);

  if (answer === "yes") {
    return (
      <p role="status" className="anim-pop rounded-2xl bg-sage-soft px-4 py-3.5 text-text-on-sage">
        Good. You can come back to this card any time.
      </p>
    );
  }

  if (answer === "no") {
    return (
      <div role="status" className="anim-pop flex flex-col gap-2.5 rounded-2xl bg-surface p-4">
        <p className="font-semibold">That&apos;s okay. Not every card works every time.</p>
        <Link
          href="/help-now"
          className="tap flex min-h-12 items-center justify-center rounded-full bg-ink px-4 font-semibold text-white no-underline hover:text-white"
        >
          Talk to someone now
        </Link>
        <Link href="/coping" className={`${secondary} tap`}>
          Try another card
        </Link>
        {told === "sent" && <p className="text-caption text-text-2">Your care team has been told. Someone will be in touch.</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => setAnswer("yes")} className={`${secondary} tap cursor-pointer`}>
          That helped
        </button>
        <button type="button" onClick={() => setAnswer("no")} className={`${secondary} tap cursor-pointer`}>
          This isn&apos;t helping
        </button>
      </div>
    </div>
  );
}

const REASON_FIELDS = [
  { key: "reasons", label: "My reasons to keep going", hint: "People, pets, plans, things you care about" },
  { key: "people", label: "People I can contact", hint: "Names and numbers" },
  { key: "places", label: "Places and things that help", hint: "A walk, a café, music, a shower" },
  { key: "next", label: "My next steps when it gets hard", hint: "What you'll try first, then next" },
] as const;
const STORE = "bl_my_reasons";

/** Kept only in this browser (never sent to us), with a clear way to delete it. */
export function MyReasons() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setTimeout(() => setValues(JSON.parse(raw)), 0);
    } catch {
      // Storage blocked (private window): the form still works for this visit.
    }
  }, []);
  const save = (next: Record<string, string>) => {
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  };
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(values);
      }}
    >
      <p className="rounded-2xl bg-sky px-4 py-3 text-caption text-text-2">
        Saved only on this device. It is never sent to us or your care team.
      </p>
      {REASON_FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1.5">
          <span className="font-semibold">{f.label}</span>
          <span className="text-caption text-muted">{f.hint}</span>
          <textarea
            value={values[f.key] ?? ""}
            onChange={(e) => {
              setValues((v) => ({ ...v, [f.key]: e.target.value }));
              setSaved(false);
            }}
            rows={3}
            maxLength={1000}
            className="rounded-2xl border-[1.5px] border-line bg-surface px-4 py-3 text-base"
          />
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="min-h-12 cursor-pointer rounded-full bg-primary px-6 font-medium text-white">
          Save on this device
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem(STORE);
            } catch {}
            setValues({});
            setSaved(false);
          }}
          className="min-h-11 cursor-pointer text-caption text-primary-dark underline underline-offset-2"
        >
          Delete everything
        </button>
        {saved && (
          <span role="status" className="text-caption text-text-2">
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}
