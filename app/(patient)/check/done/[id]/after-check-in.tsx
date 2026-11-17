"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { recordFeeling } from "../../actions";
import { RESULT_KEY, useStoredValue } from "@/lib/check/local-answers";
import { BreathingIcon, ChatIcon, ChevronRight } from "@/components/icons";

type StoredScore = { instrument: string; band: string; positive?: boolean };

/**
 * One coping card picked from what the person told us (design canvas: "Picked
 * for you"). A fixed rule on the scores this tab already holds, never AI:
 * worry first (breathing), then low mood (reach out), else breathing.
 */
function pick(raw: string | null) {
  let scores: StoredScore[] = [];
  try {
    scores = raw ? (JSON.parse(raw).scores ?? []) : [];
  } catch {
    // nothing stored: use the default card
  }
  const raised = (prefix: string) =>
    scores.some((s) => s.instrument.startsWith(prefix) && (s.positive === true || !["minimal", "negative"].includes(s.band)));
  if (raised("GAD"))
    return { href: "/coping/breathing", title: "You mentioned worry. Try Paced breathing", meta: "2 minutes · calming", lift: false };
  if (raised("PHQ"))
    return { href: "/coping/reach-out", title: "You mentioned low mood. Try Reach out", meta: "Message someone · mood lifting", lift: true };
  return { href: "/coping/breathing", title: "While you wait, try Paced breathing", meta: "2 minutes · calming", lift: false };
}

export function PickedCard() {
  const card = pick(useStoredValue(RESULT_KEY));
  return (
    <>
      <Link
        href={card.href}
        className={`tap flex min-h-11 items-center gap-3.5 rounded-2xl px-4 py-3.5 text-ink no-underline hover:text-ink ${
          card.lift ? "bg-cat-lift" : "bg-sky"
        }`}
      >
        {card.lift ? <ChatIcon size={44} blob="var(--cat-lift-deep)" /> : <BreathingIcon size={44} blob="var(--cat-calm-deep)" />}
        <span className="flex flex-1 flex-col">
          <span className={`text-[0.75rem] font-semibold tracking-[0.04em] uppercase ${card.lift ? "text-(--cat-lift-ink)" : "text-blue"}`}>
            Picked for you
          </span>
          <strong className="font-semibold">{card.title}</strong>
          <span className={`text-small ${card.lift ? "text-(--cat-lift-ink)" : "text-blue-ink"}`}>{card.meta}</span>
        </span>
        <ChevronRight />
      </Link>
      <Link href="/coping" className="inline-flex min-h-10 items-center self-start text-caption">
        See all coping cards
      </Link>
    </>
  );
}

const THANKS = {
  easy: "Thank you. That helps us improve the check-in.",
  ok: "Thank you. That helps us improve the check-in.",
  hard: "Thank you for telling us. Those questions can be hard. Your clinician will see that it felt difficult.",
  skip: "No problem.",
} as const;

/** "How did that feel?" (optional). "Hard" shows on the case for the clinician. */
export function HowDidThatFeel() {
  const [answer, setAnswer] = useState<keyof typeof THANKS | null>(null);
  const [, start] = useTransition();
  const choose = (a: "easy" | "ok" | "hard") => {
    setAnswer(a);
    start(async () => {
      await recordFeeling(a).catch(() => null);
    });
  };
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-surface px-4 py-3.5">
      {answer === null ? (
        <>
          <span id="feel-h" className="font-semibold">
            How did that feel? <span className="font-normal text-muted">(optional)</span>
          </span>
          <div role="group" aria-labelledby="feel-h" className="flex flex-wrap gap-2">
            {(
              [
                ["easy", "Easy"],
                ["ok", "OK"],
                ["hard", "Hard"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                className="tap min-h-11 cursor-pointer rounded-full border-[1.5px] border-line bg-surface px-4 text-caption font-medium text-ink hover:border-primary"
              >
                {label}
              </button>
            ))}
            <button type="button" onClick={() => setAnswer("skip")} className="min-h-11 cursor-pointer px-3 text-caption text-muted underline">
              Skip
            </button>
          </div>
        </>
      ) : (
        <span role="status" className="anim-pop text-text-2">
          {THANKS[answer]}
        </span>
      )}
    </div>
  );
}
