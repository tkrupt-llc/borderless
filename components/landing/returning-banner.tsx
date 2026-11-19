"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { notMe, returningVisitor } from "@/app/returning-actions";
import { RETURNING_BANNER } from "@/lib/returning/banner";

/**
 * Shown at the top of the landing page when this browser has a check-in in
 * progress. Neutral words only. "Not me" clears it, like Quick exit does.
 */
export function ReturningBanner() {
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    returningVisitor()
      .then((r) => !cancelled && setShow(r.show))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;
  return (
    <div role="region" aria-label="Welcome back" className="border-b border-line-warm bg-sky">
      <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <p className="text-body text-blue-ink">{RETURNING_BANNER.text}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/home"
            className="tap inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-semibold text-white no-underline hover:text-white"
          >
            {RETURNING_BANNER.continue}
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  sessionStorage.clear();
                } catch {
                  // storage blocked: nothing to clear
                }
                await notMe().catch(() => null);
                setShow(false);
              })
            }
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] border-ink bg-surface px-5 font-medium text-ink disabled:cursor-wait"
          >
            {RETURNING_BANNER.notMe}
          </button>
        </div>
      </div>
    </div>
  );
}
