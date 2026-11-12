"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkAnswers, finishCheckIn, type CheckResult, type FinishResult } from "../../actions";
import { markSubmitted, saveAnswer, useStoredAnswer } from "@/lib/check/local-answers";

type Option = { value: number; label: string };

export function AnswerList({
  path,
  itemId,
  options,
  nextHref,
}: {
  path: string;
  itemId: string;
  options: Option[];
  /** null on the last question */
  nextHref: string | null;
}) {
  const router = useRouter();
  const stored = useStoredAnswer(path, itemId);
  const [picked, setPicked] = useState<number | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const selected = picked ?? stored;

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
        if (result.reason === "no_session") router.replace(`/check/${path}/consent`);
        else setFailed(true);
        return;
      }
      if (result.takeover) {
        router.replace("/help-now");
        return;
      }
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
        if (finished.reason === "no_session") router.replace(`/check/${path}/consent`);
        else setFailed(true);
        return;
      }
      markSubmitted(path, finished);
      router.push(`/check/${path}/result`);
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
              className={`flex min-h-[52px] w-full cursor-pointer items-center justify-between rounded-2xl border-[1.5px] px-[18px] py-3 text-left sm:min-h-14 sm:py-3.5 text-body font-medium disabled:cursor-wait ${
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
      <p role="status" className="min-h-6 text-caption text-muted">
        {failed ? "That answer didn't go through. Please choose it again." : ""}
      </p>
    </>
  );
}
