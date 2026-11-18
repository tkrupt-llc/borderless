"use client";

import { useState, useTransition } from "react";
import { saveAboutYou } from "../../actions";
import aboutYou from "@/content/about-you.json";

const chip = (on: boolean) =>
  `min-h-10 cursor-pointer rounded-full border-[1.5px] px-3.5 text-caption ${
    on ? "border-primary bg-primary font-medium text-white" : "border-line bg-surface text-ink hover:border-primary"
  }`;

/**
 * "About you" (optional): only for people who chose anonymous statistics. Used
 * only to check the service is fair for everyone; every question can be left.
 */
export function AboutYou() {
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [status, setStatus] = useState<"idle" | "saved" | "skipped" | "failed">("idle");
  const [pending, start] = useTransition();

  if (status === "saved" || status === "skipped") {
    return (
      <p role="status" className="rounded-2xl bg-sage-mist px-4 py-3 text-caption">
        {status === "saved" ? "Thank you. That helps us check the service works fairly for everyone." : "No problem."}
      </p>
    );
  }

  return (
    <section aria-labelledby="about-h" className="anim-pop flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-surface px-4 py-3.5">
      <div>
        <h2 id="about-h" className="font-semibold">
          About you <span className="font-normal text-muted">(optional)</span>
        </h2>
        <p className="text-caption text-text-2">
          Only used to check the service is fair for everyone. Never used for your care, never shown to an employer, and
          you can skip any question.
        </p>
      </div>
      {aboutYou.questions.map((q) => (
        <fieldset key={q.id} className="flex flex-col gap-1.5">
          <legend className="mb-1 text-caption font-medium">{q.label}</legend>
          <div role="radiogroup" aria-label={q.label} className="flex flex-wrap gap-1.5">
            {[...q.options, "Prefer not to say"].map((opt) => {
              const value = opt === "Prefer not to say" ? null : opt;
              const on = q.id in answers && answers[q.id] === value;
              return (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: value }))}
                  className={chip(on)}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveAboutYou(answers).catch(() => ({ ok: false as const }));
              setStatus(r.ok ? "saved" : "failed");
            })
          }
          className="flex min-h-11 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-ink px-5 text-caption font-medium text-ink disabled:cursor-wait"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setStatus("skipped")} className="min-h-11 cursor-pointer text-caption text-muted underline">
          Skip
        </button>
      </div>
      {status === "failed" && (
        <p role="status" className="text-caption text-danger">
          That didn&apos;t save. Please try again.
        </p>
      )}
    </section>
  );
}
