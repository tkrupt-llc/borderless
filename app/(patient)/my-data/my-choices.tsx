"use client";

import { useEffect, useState, useTransition } from "react";
import { changeMyChoice, loadMyChoices, type MyChoices } from "./actions";

/**
 * "Your choices": every consent, with its current state and a plain button to
 * change it (no toggle switches). Each change is logged for the care team.
 */
export function MyChoicesList() {
  const [data, setData] = useState<MyChoices | null>(null);
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    loadMyChoices().then(setData, () => setData({ connected: false, choices: [] }));
  }, []);

  if (!data || !data.connected || data.choices.length === 0) return null;

  const change = (id: string, granted: boolean, title: string) =>
    start(async () => {
      const r = await changeMyChoice(id, granted).catch(() => ({ ok: false }));
      if (!r.ok) return setStatus("That didn't save. Please try again.");
      setData((d) => d && { ...d, choices: d.choices.map((c) => (c.id === id ? { ...c, granted } : c)) });
      setStatus(`${title}: ${granted ? "turned on" : "turned off"}. Saved, and your care team can see the change.`);
    });

  return (
    <section aria-labelledby="choices-h" className="flex flex-col gap-2.5 rounded-2xl bg-surface px-4 py-3.5">
      <h2 id="choices-h" className="font-semibold">
        Your choices
      </h2>
      <p className="text-caption text-text-2">Change any of these at any time. Never shared with your employer or university.</p>
      <ul className="flex flex-col">
        {data.choices.map((c, i) => (
          <li key={c.id} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5 ${i ? "border-t border-line-warm" : ""}`}>
            <span className="flex min-w-0 flex-1 basis-56 flex-col">
              <strong className="font-medium">{c.title}</strong>
              <span className="text-small text-muted">
                {c.granted ? "On" : "Off"}
                {!c.changeable && " · needed to use the check-in. To withdraw it, delete your data below."}
              </span>
            </span>
            {c.changeable && (
              <button
                type="button"
                disabled={pending}
                onClick={() => change(c.id, !c.granted, c.title)}
                aria-label={`${c.granted ? "Turn off" : "Turn on"}: ${c.title}`}
                className={`tap min-h-10 cursor-pointer rounded-full px-4 text-caption font-medium disabled:cursor-wait ${
                  c.granted ? "border-[1.5px] border-ink text-ink" : "bg-primary text-white"
                }`}
              >
                {c.granted ? "Turn off" : "Turn on"}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p role="status" className="min-h-5 text-caption text-text-2">
        {status}
      </p>
    </section>
  );
}
