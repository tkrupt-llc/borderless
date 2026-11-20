"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { startCheckIn } from "../../actions";
import { clearAnswers } from "@/lib/check/local-answers";
import { purposesFor } from "@/lib/consent";
import en from "@/content/i18n/en.json";

export function ConsentForm() {
  const { path } = useParams<{ path: string }>();
  const router = useRouter();
  // Only what is needed to start; the rest is asked where it matters (research: ask only what is needed).
  const START_PURPOSES = purposesFor("start", path);
  const [choices, setChoices] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(purposesFor("start", path).map((p) => [p.id, p.default])),
  );
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFailed(false);
    startTransition(async () => {
      let result;
      try {
        result = await startCheckIn({ path, consents: choices });
      } catch {
        result = { ok: false as const };
      }
      if (!result.ok) {
        setFailed(true);
        return;
      }
      clearAnswers(path);
      // The full check-in starts with the AI conversation only with "AI help"; otherwise straight to the questions.
      router.push(path === "full" && choices.ai_help ? `/check/${path}/chat` : `/check/${path}/1`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 px-5 pt-4">
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
              <strong className="font-semibold">
                {p.title}
                {"required" in p && p.required ? <span className="font-normal text-muted"> (needed)</span> : <span className="font-normal text-muted"> (optional)</span>}
              </strong>
              <span className="text-caption text-muted">{p.explanation}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* Research: plain data promise on the consent screen too. */}
      <details className="text-caption">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-primary-dark underline">
          Read the full privacy details
        </summary>
        <ul className="mt-1 flex list-disc flex-col gap-1 rounded-2xl bg-sky py-3 ps-9 pe-4 text-text-2">
          {en.trust.dataPromise.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>

      <p className="text-caption text-text-2">
        Never shared with your employer or university. You can change these choices later in &ldquo;See or delete your
        data&rdquo;.
      </p>

      {/* Nothing is pre-ticked, so the button says plainly what will happen. */}
      <button
        type="submit"
        disabled={pending || !choices.clinician_review}
        className="tap mt-2 flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-primary px-6 font-semibold text-white disabled:cursor-default disabled:opacity-45"
      >
        {pending ? "Saving…" : "I understand, let's start"}
      </button>
      <Link href="/start" className="flex min-h-11 items-center justify-center text-caption">
        Not now
      </Link>
      <p role="status" className="min-h-6 text-caption text-muted">
        {failed ? "That didn't save. Please try again." : ""}
      </p>
    </form>
  );
}
