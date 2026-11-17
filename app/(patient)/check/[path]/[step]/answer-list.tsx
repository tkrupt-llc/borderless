"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkAnswers, finishCheckIn, pauseCheckIn, type CheckResult, type FinishResult } from "../../actions";
import { markSubmitted, saveAnswer, useStoredAnswer } from "@/lib/check/local-answers";
import { nextAskedIndex } from "@/lib/check/conditions";
import { canSkip, SKIPPED } from "@/lib/check/skip";

type Option = { value: number; label: string };

export function AnswerList({
  path,
  itemId,
  options,
  itemIds,
  index,
}: {
  path: string;
  itemId: string;
  options: Option[];
  /** Every question on this path, in order; some are asked only after certain answers. */
  itemIds: string[];
  index: number;
}) {
  const router = useRouter();
  const stored = useStoredAnswer(path, itemId);
  const [picked, setPicked] = useState<number | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pausing, startPause] = useTransition();
  const selected = picked ?? stored;
  const skippable = canSkip(itemId);

  function choose(value: number) {
    if (pending) return;
    setPicked(value);
    setFailed(false);
    const answers = saveAnswer(path, itemId, value);
    startTransition(async () => {
      let result: CheckResult;
      try {
        result = await checkAnswers({ path, answers });
      } catch {
        result = { ok: false, reason: "error" };
      }
      // Never move on without a completed safety check.
      if (!result.ok) {
        if (result.reason === "no_session") router.replace(path === "safety" ? "/help-now" : `/check/${path}/consent`);
        else setFailed(true);
        return;
      }
      // A red flag sends the person to the crisis page. On the safety questions
      // they are already on the crisis route: the on-call clinician has been
      // alerted, and the remaining safety questions continue.
      if (result.takeover && path !== "safety") {
        router.replace("/help-now");
        return;
      }
      const next = nextAskedIndex(itemIds, index, answers);
      const nextHref = next === null ? null : `/check/${path}/${next + 1}`;
      if (nextHref) {
        router.push(nextHref);
        return;
      }
      let finished: FinishResult;
      try {
        finished = await finishCheckIn({ path, answers });
      } catch {
        finished = { ok: false, reason: "error" };
      }
      if (!finished.ok) {
        if (finished.reason === "no_session") router.replace(path === "safety" ? "/help-now" : `/check/${path}/consent`);
        else setFailed(true);
        return;
      }
      markSubmitted(path, finished);
      // With clinician review on, ask how to reach the person before the result (design canvas flow).
      router.push(finished.sentToClinician && path !== "safety" ? `/check/${path}/contact` : `/check/${path}/result`);
    });
  }

  return (
    <>
      <div role="radiogroup" aria-labelledby="question" className="flex flex-col gap-2 sm:mt-1 sm:gap-2.5">
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={pending}
              onClick={() => choose(option.value)}
              className={`tap flex min-h-[52px] w-full cursor-pointer items-center justify-between rounded-2xl border-[1.5px] px-[18px] py-3 text-left sm:min-h-14 sm:py-3.5 text-body font-medium disabled:cursor-wait ${
                isSelected ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:border-primary"
              }`}
            >
              <span>{option.label}</span>
              {isSelected && (
                <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
                  <circle cx="11" cy="11" r="10" fill="#FFFFFF" />
                  <path
                    d="M6.5 11.5l3 3 6-6.5"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      {skippable && (
        <button
          type="button"
          aria-pressed={selected === SKIPPED}
          disabled={pending}
          onClick={() => choose(SKIPPED)}
          className={`tap min-h-11 cursor-pointer self-start rounded-full px-4 text-caption font-medium disabled:cursor-wait ${
            selected === SKIPPED ? "border-[1.5px] border-text-2 bg-text-2 text-white" : "border-[1.5px] border-dashed border-[#9aa38c] text-text-2"
          }`}
        >
          Prefer not to say
        </button>
      )}
      <p role="status" className="min-h-6 text-caption text-muted">
        {failed ? "That answer didn't go through. Please choose it again." : ""}
      </p>
      {path !== "safety" && (
        <button
          type="button"
          disabled={pausing}
          onClick={() =>
            startPause(async () => {
              const r = await pauseCheckIn().catch(() => ({ ok: false }));
              if (r.ok) router.push("/home?paused=1");
              else setFailed(true);
            })
          }
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-center text-caption text-primary-dark underline underline-offset-2"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <rect x="4" y="3" width="3" height="12" rx="1" fill="currentColor" />
            <rect x="11" y="3" width="3" height="12" rx="1" fill="currentColor" />
          </svg>
          {pausing ? "Saving…" : "Pause and finish later · your answers are saved"}
        </button>
      )}
    </>
  );
}
