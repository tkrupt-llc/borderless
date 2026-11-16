"use client";

import { useState, useTransition } from "react";
import { requestCallback, type CallbackResult } from "./actions";
import { CLINICIAN_CHOICES, LANGUAGES } from "./options";
import { isDiscreet } from "@/lib/discreet";
import { formatWhen } from "@/lib/receipt/build";

const input = "min-h-12 rounded-xl border-[1.5px] border-line bg-surface px-3 text-body";

/** Short form: phone, language, clinician preference, best time (research: ask only what is needed). */
export function CallbackForm() {
  const [result, setResult] = useState<CallbackResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setResult(
          await requestCallback({
            phone: String(form.get("phone") ?? ""),
            language: String(form.get("language") ?? ""),
            clinician: String(form.get("clinician") ?? ""),
            callbackTime: String(form.get("callbackTime") ?? ""),
            discreet: isDiscreet(),
          }),
        );
      } catch {
        setResult({ ok: false, reason: "error" });
      }
    });
  }

  if (result?.ok) {
    return (
      <div role="status" className="rounded-2xl bg-sage px-4 py-3.5 text-text-on-sage">
        <strong className="font-semibold text-ink">Your request is in. Reference {result.ref}.</strong>
        <p className="mt-1">
          A person from the care team will call you by <strong>{formatWhen(result.dueAt)}</strong>.
        </p>
        <p className="mt-1 text-caption">If things get worse before then, tap &ldquo;I need help now&rdquo;.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Your phone number</span>
        <input name="phone" type="tel" autoComplete="tel" inputMode="tel" required className={input} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Language for the call</legend>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((language, i) => (
            <label
              key={language}
              className="flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] border-line bg-surface px-4 text-caption font-medium has-checked:border-primary has-checked:bg-primary has-checked:text-white has-focus-visible:outline-3 has-focus-visible:outline-primary-dark"
            >
              <input type="radio" name="language" value={language} defaultChecked={i === 0} className="sr-only" />
              {language}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Who would you like to speak to?</legend>
        <div className="flex flex-wrap gap-2">
          {CLINICIAN_CHOICES.map((choice, i) => (
            <label
              key={choice}
              className="flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] border-line bg-surface px-4 text-caption font-medium has-checked:border-primary has-checked:bg-primary has-checked:text-white has-focus-visible:outline-3 has-focus-visible:outline-primary-dark"
            >
              <input type="radio" name="clinician" value={choice} defaultChecked={i === 0} className="sr-only" />
              {choice}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-semibold">
          Best time to call <span className="font-normal text-muted">(optional)</span>
        </span>
        <input name="callbackTime" type="text" maxLength={80} placeholder="For example: weekdays after 6 pm" className={input} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-primary px-6 font-medium text-white disabled:cursor-wait"
      >
        {pending ? "Sending…" : "Ask for a call"}
      </button>
      <p role="alert" className="min-h-6 text-caption text-text-2">
        {result?.ok === false &&
          (result.reason === "invalid"
            ? "Please check the phone number."
            : result.reason === "not_connected"
              ? "This prototype is not connected to a care team yet. You can call 800-SAKINA below."
              : "That didn't send. Please try again, or call 800-SAKINA below.")}
      </p>
    </form>
  );
}
