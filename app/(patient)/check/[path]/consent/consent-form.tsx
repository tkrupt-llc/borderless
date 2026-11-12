"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { startCheckIn } from "../../actions";
import { clearAnswers } from "@/lib/check/local-answers";
import { isDiscreet } from "@/lib/discreet";
import consent from "@/content/consent.json";
import en from "@/content/i18n/en.json";

// Only what is needed to start; the rest is asked on the result page (research: ask only what is needed).
const START_PURPOSES = consent.purposes.filter((p) => p.askOn === "start");

export function ConsentForm() {
  const { path } = useParams<{ path: string }>();
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(START_PURPOSES.map((p) => [p.id, p.default])),
  );
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFailed(false);
    startTransition(async () => {
      let result;
      try {
        result = await startCheckIn({ path, discreet: isDiscreet(), consents: choices });
      } catch {
        result = { ok: false as const };
      }
      if (!result.ok) {
        setFailed(true);
        return;
      }
      clearAnswers(path);
      // The full check-in starts with the AI conversation; the quick check goes straight to the questions.
      router.push(path === "full" ? `/check/${path}/chat` : `/check/${path}/1`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 px-5 pt-5">
      <fieldset className="flex flex-col gap-2.5">
        <legend className="sr-only">What happens with your answers</legend>
        {START_PURPOSES.map((p) => (
          <label
            key={p.id}
            className="flex min-h-11 cursor-pointer items-start gap-3.5 rounded-2xl border-[1.5px] border-line bg-surface px-4 py-3.5 has-checked:border-primary"
          >
            <input
              type="checkbox"
              checked={choices[p.id]}
              onChange={(e) => setChoices((c) => ({ ...c, [p.id]: e.target.checked }))}
              className="mt-1 size-5 shrink-0 cursor-pointer accent-primary"
            />
            <span className="flex flex-col">
              <strong className="font-semibold">{p.title}</strong>
              <span className="text-caption text-muted">{p.explanation}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* Research: plain data promise on the consent screen too. */}
      <details className="text-caption">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-primary-dark underline">
          {en.trust.readDataPromise}
        </summary>
        <ul className="mt-1 flex list-disc flex-col gap-1 rounded-2xl bg-sage-soft py-3 ps-9 pe-4 text-text-2">
          {en.trust.dataPromise.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>

      {!choices.clinician_review && (
        <p className="rounded-2xl bg-sage-soft px-4 py-3 text-caption text-text-2">
          Without clinician review, your answers stay with you and no one will contact you. If you are in danger,
          &ldquo;I need help now&rdquo; still works.
        </p>
      )}

      {/* Nothing is pre-ticked, so the button says plainly what will happen. */}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-primary px-6 font-medium text-white disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? "Saving…" : choices.clinician_review ? "Continue" : "Continue without clinician review"}
      </button>
      <p role="status" className="min-h-6 text-caption text-muted">
        {failed ? "That didn't save. Please try again." : ""}
      </p>
    </form>
  );
}
