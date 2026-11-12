"use client";

import { setDiscreet, useDiscreet } from "@/lib/discreet";

/** Plain button (aria-pressed), not a switch. */
export function DiscreetToggle() {
  const on = useDiscreet();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
      <span className="flex flex-col">
        <strong className="text-base font-semibold">Discreet mode {on ? "is on" : ""}</strong>
        <span className="text-small text-muted">Plain tab title (&ldquo;Wellbeing check&rdquo;) and icon</span>
      </span>
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setDiscreet(!on)}
        className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 text-caption font-medium text-ink"
      >
        {on ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}
