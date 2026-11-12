"use client";

import { useState, useTransition } from "react";
import { recordLaterConsents } from "../../actions";
import { updateStoredResult } from "@/lib/check/local-answers";
import consent from "@/content/consent.json";

// Asked here rather than before the questions (research: ask only what is
// needed, when it matters). Nothing is pre-ticked; each choice is logged.
const LATER = consent.purposes.filter((p) => p.askOn === "result");

export function LaterChoices({ path }: { path: string }) {
  const [choices, setChoices] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(LATER.map((p) => [p.id, p.default])),
  );
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const r = await recordLaterConsents({ path, consents: choices });
        if (!r.ok) throw new Error(r.reason);
        updateStoredResult({ followUp: choices.follow_up === true });
        setStatus("saved");
      } catch {
        setStatus("failed");
      }
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-line bg-surface px-4 py-3.5">
      <fieldset className="flex flex-col gap-3" disabled={status === "saved"}>
        <legend className="mb-1 font-semibold">Two more choices (optional)</legend>
        {LATER.map((p) => (
          <label key={p.id} className="flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={choices[p.id]}
              onChange={(e) => setChoices((c) => ({ ...c, [p.id]: e.target.checked }))}
              className="mt-1 size-5 shrink-0 cursor-pointer accent-primary"
            />
            <span className="flex flex-col">
              <span className="font-medium">{p.title}</span>
              <span className="text-caption text-muted">{p.explanation}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {status !== "saved" ? (
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-11 cursor-pointer items-center justify-center self-start rounded-full border-[1.5px] border-ink px-5 text-caption font-medium text-ink disabled:cursor-wait"
        >
          {pending ? "Saving…" : "Save my choices"}
        </button>
      ) : null}
      <p role="status" className="text-caption text-text-2">
        {status === "saved" ? "Saved." :status === "failed" ? "That didn't save. Please try again." : ""}
      </p>
    </form>
  );
}
