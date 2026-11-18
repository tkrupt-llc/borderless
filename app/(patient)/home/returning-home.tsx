"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { restoreAnswers } from "@/lib/check/local-answers";
import { forget, readRemembered, type RememberedFollowUp } from "@/lib/followup/device";
import { FOLLOW_UP_DAYS } from "@/lib/followup/trend";
import { loadInProgress, loadReceipt, loadMyTrend, type InProgress, type MyTrend } from "../check/actions";
import type { ReceiptView } from "@/lib/receipt/build";

const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(d);
const chip =
  "tap inline-flex min-h-11 items-center rounded-full border-[1.5px] border-line bg-surface px-4 text-caption text-ink no-underline hover:text-ink";

/** "Monday morning · last check-in 4 weeks ago" (design canvas). */
function whenLine(now: Date, followUp: RememberedFollowUp | null): string {
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(now);
  const h = now.getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  if (!followUp) return `${weekday} ${part}`;
  const last = new Date(followUp.due).getTime() - FOLLOW_UP_DAYS * 86_400_000;
  const weeks = Math.max(0, Math.round((now.getTime() - last) / (7 * 86_400_000)));
  return `${weekday} ${part} · last check-in ${weeks === 0 ? "this week" : weeks === 1 ? "1 week ago" : `${weeks} weeks ago`}`;
}

type Loaded = { followUp: RememberedFollowUp | null; receipt: ReceiptView | null; trend: MyTrend | null; paused: InProgress | null; now: number };

/**
 * Home for a returning patient: one next step (design canvas rule 4).
 * Follow-up due → that check-in. Waiting for a reply → where things are, plus one
 * coping card. Otherwise → a gentle way to start. Quieter options below.
 */
export function ReturningHome() {
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const followUp = readRemembered();
      const [receipt, trend, paused] = await Promise.all([
        loadReceipt().catch(() => null),
        loadMyTrend().catch(() => null),
        loadInProgress().catch(() => null),
      ]);
      if (!cancelled) setData({ followUp, receipt, trend, paused, now: Date.now() });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <p className="px-5 pt-8 text-text-2">Loading…</p>;
  const { followUp, receipt, trend, paused, now } = data;
  const due = followUp ? new Date(followUp.due) : null;
  const isDue = due ? due.getTime() - now < 3 * 86_400_000 : false;
  const nowStep = receipt?.steps.find((s) => s.state === "now");
  const waiting = !isDue && nowStep;
  const phq = trend?.points.filter((p) => p.instrument === "PHQ9" || p.instrument === "PHQ2") ?? [];
  const moodChange = trend && trend.checkIns >= 2 && phq.length >= 2 ? { from: phq[0].total, to: phq.at(-1)!.total } : null;

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 pt-8">
      <div className="anim-pop">
        <p className="text-caption text-muted">{whenLine(new Date(now), followUp)}</p>
        <h1 className="mt-1 font-serif text-[2.125rem] leading-tight font-normal">
          Welcome <em className="text-primary">back.</em>
        </h1>
      </div>

      {paused ? (
        <div className="anim-pop anim-delay-1 flex flex-col gap-3.5 rounded-3xl bg-surface p-6 shadow-[0_12px_40px_rgba(31,42,28,0.08)]">
          <span className="text-[0.75rem] font-semibold tracking-[0.06em] text-primary-dark uppercase">Your one next step</span>
          <h2 className="font-serif text-[1.625rem] leading-tight font-medium">Finish your check-in</h2>
          <p className="text-text-2">
            {paused.answered === 0
              ? "You started a check-in. Carry on where you left off."
              : `You've answered ${paused.answered} ${paused.answered === 1 ? "question" : "questions"}. Your answers are saved, so carry on where you left off.`}
          </p>
          <button
            type="button"
            onClick={() => {
              restoreAnswers(paused.path, paused.answers);
              router.push(paused.resumeHref);
            }}
            className="tap flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-primary font-semibold text-white"
          >
            Continue check-in
          </button>
        </div>
      ) : waiting ? (
        <>
          <div className="anim-pop anim-delay-1 flex flex-col gap-3.5 rounded-3xl bg-sky p-6">
            <span className="text-[0.75rem] font-semibold tracking-[0.06em] text-blue uppercase">Where things are</span>
            <h2 className="font-serif text-[1.625rem] leading-tight font-medium">{nowStep.title}</h2>
            <p className="text-blue-ink">{nowStep.body}</p>
            <Link href="/check/done/current" className="inline-flex min-h-11 items-center self-start font-semibold text-blue">
              See the full timeline →
            </Link>
          </div>
          <Link
            href="/coping/breathing"
            className="tap anim-pop anim-delay-2 flex items-center gap-3.5 rounded-[20px] bg-surface p-[18px] text-ink no-underline hover:text-ink"
          >
            <svg width="48" height="48" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="34" cy="34" r="24" fill="var(--cat-calm-deep)" />
              <path d="M30 30a4 4 0 1 1 6 3.5 9 9 0 1 1-12-8.5 14 14 0 1 1-12 13" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
            <span className="flex flex-col">
              <span className="text-[0.75rem] font-semibold tracking-[0.04em] text-blue uppercase">While you wait</span>
              <strong className="font-semibold">Breathe with me · 2 minutes</strong>
            </span>
          </Link>
        </>
      ) : (
        <div className="anim-pop anim-delay-1 flex flex-col gap-3.5 rounded-3xl bg-surface p-6 shadow-[0_12px_40px_rgba(31,42,28,0.08)]">
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
              {moodChange && (
                <div className="flex items-center gap-3.5 rounded-2xl bg-sky px-4 py-3.5">
                  <svg width="96" height="40" viewBox="0 0 96 40" aria-hidden="true">
                    <polyline points="6,8 48,20" fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" />
                    <g fill="var(--blue)">
                      <circle cx="6" cy="8" r="4" />
                      <circle cx="48" cy="20" r="4" />
                    </g>
                    <circle cx="90" cy="30" r="4" fill="none" stroke="var(--blue)" strokeWidth="2" strokeDasharray="2 2" />
                  </svg>
                  <span className="text-caption text-blue-ink">
                    Mood score went from {moodChange.from} to {moodChange.to} last time. Lower is better.
                  </span>
                </div>
              )}
              <Link
                href={`/f/${followUp.token}`}
                className="tap flex min-h-[52px] items-center justify-center rounded-full bg-primary font-semibold text-white no-underline hover:text-white"
              >
                Start check-in
              </Link>
              <button
                type="button"
                onClick={() => {
                  forget();
                  setData((d) => (d ? { ...d, followUp: null } : d));
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
      )}

      <div className="anim-pop anim-delay-2 flex flex-col gap-2 pt-1">
        <p className="text-caption text-muted">If today is harder:</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/coping" className={chip}>Coping cards</Link>
          <Link href="/coping/my-reasons" className={chip}>My reasons and next steps</Link>
          <Link href="/talk" className={chip}>Talk to someone</Link>
          <Link href="/support-options" className={chip}>Your support options</Link>
        </div>
      </div>
    </div>
  );
}
