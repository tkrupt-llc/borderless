"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Result = { ok: true } | { ok: false; error: string };

/** Re-reads the page from the server every few seconds, so new cases appear on their own. */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  const [at, setAt] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setAt(new Date());
    };
    const first = setTimeout(() => setAt(new Date()), 0);
    const id = setInterval(tick, seconds * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [router, seconds]);
  // Freshness is always visible (research: show how current the data is).
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted">
      <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
      Live · updated {at ? at.toLocaleTimeString("en-GB") : "…"}
    </span>
  );
}

function format(ms: number): string {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Live time left on a response clock. Overdue is stated in words, not only by colour. */
export function Countdown({ dueAt }: { dueAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <span className="tabular-nums text-muted">…</span>;
  const left = new Date(dueAt).getTime() - now;
  return left >= 0 ? (
    <span className="tabular-nums">{format(left)} left</span>
  ) : (
    <strong className="font-semibold tabular-nums text-danger">Overdue by {format(left)}</strong>
  );
}

/** A button that runs a server action and shows its error, if any. */
export function ActionButton({
  action,
  children,
  variant = "outline",
  disabled,
}: {
  action: () => Promise<Result>;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            const r = await action().catch(() => ({ ok: false as const, error: "That didn't save. Please try again." }));
            setError(r.ok ? "" : r.error);
          })
        }
        className={`min-h-11 cursor-pointer rounded-full px-4 text-caption font-medium disabled:cursor-default disabled:opacity-50 ${
          variant === "primary" ? "bg-primary text-white" : "border-[1.5px] border-ink text-ink"
        }`}
      >
        {pending ? "Saving…" : children}
      </button>
      {error && (
        <span role="alert" className="text-small text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
