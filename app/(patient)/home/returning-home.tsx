"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { forget, readRemembered, type RememberedFollowUp } from "@/lib/followup/device";

const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(d);
const chip =
  "tap inline-flex min-h-11 items-center rounded-full border-[1.5px] border-line bg-surface px-4 text-caption text-ink no-underline hover:text-ink";

/** One next step: the remembered follow-up (due or not yet), or a way to start. */
export function ReturningHome() {
  const [state, setState] = useState<{ ready: boolean; followUp: RememberedFollowUp | null; now: number }>({
    ready: false,
    followUp: null,
    now: 0,
  });
  useEffect(() => {
    const id = setTimeout(() => setState({ ready: true, followUp: readRemembered(), now: Date.now() }), 0);
    return () => clearTimeout(id);
  }, []);

  if (!state.ready) return <p className="px-5 pt-8 text-text-2">Loading…</p>;
  const { followUp, now } = state;
  const due = followUp ? new Date(followUp.due) : null;
  const isDue = due ? due.getTime() - now < 3 * 86_400_000 : false;

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 pt-8">
      <h1 className="anim-pop font-serif text-[2.125rem] leading-tight font-normal">
        Welcome <em className="text-primary">back.</em>
      </h1>

      <div className="anim-pop flex flex-col gap-3.5 rounded-3xl bg-surface p-6 shadow-[0_12px_40px_rgba(31,42,28,0.08)]">
        <span className="text-[0.75rem] font-semibold tracking-[0.06em] text-primary-dark uppercase">Your one next step</span>
        {followUp && due ? (
          <>
            <h2 className="font-serif text-[1.625rem] leading-tight font-medium">
              {isDue ? "Your 4-week check-in is ready" : `Your check-in comes up around ${day(due)}`}
            </h2>
            <p className="text-text-2">
              The same questions as last time, so you and your clinician can see what has changed. About 4 minutes.
              {!isDue && " You can also do it early if you'd like."}
            </p>
            <Link
              href={`/f/${followUp.token}`}
              className="tap flex min-h-[52px] items-center justify-center rounded-full bg-primary font-semibold text-white no-underline hover:text-white"
            >
              Start my check-in
            </Link>
            <button
              type="button"
              onClick={() => {
                forget();
                setState((s) => ({ ...s, followUp: null }));
              }}
              className="min-h-11 cursor-pointer self-center text-caption text-primary-dark underline underline-offset-2"
            >
              Forget this device
            </button>
          </>
        ) : (
          <>
            <h2 className="font-serif text-[1.625rem] leading-tight font-medium">Check in when you&apos;re ready</h2>
            <p className="text-text-2">
              A few short questions, read by a clinician. If you saved a follow-up link, open it to carry on where you left
              off.
            </p>
            <Link
              href="/start"
              className="tap flex min-h-[52px] items-center justify-center rounded-full bg-primary font-semibold text-white no-underline hover:text-white"
            >
              Start a check-in
            </Link>
          </>
        )}
      </div>

      <div className="anim-pop flex flex-col gap-2 pt-1">
        <p className="text-caption text-muted">If today is harder:</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/coping" className={chip}>Coping cards</Link>
          <Link href="/coping/my-reasons" className={chip}>My reasons and next steps</Link>
          <Link href="/talk" className={chip}>Talk to a person</Link>
        </div>
      </div>
    </div>
  );
}
