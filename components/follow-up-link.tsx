"use client";

import { useState, useSyncExternalStore } from "react";
import { FOLLOW_UP_DAYS } from "@/lib/followup/trend";

const noop = () => () => {};

/**
 * The private follow-up link. There is no account, so this link is the way
 * back; we say so plainly and make it easy to keep.
 */
export function FollowUpLink({ token, from }: { token: string; from?: string }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const url = `${origin}/f/${token}`;
  const [copied, setCopied] = useState(false);
  const [start] = useState(() => (from ? new Date(from).getTime() : Date.now()));
  const due = new Date(start + FOLLOW_UP_DAYS * 86_400_000);
  const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(due);
  const message = encodeURIComponent(`My Borderless follow-up check-in (around ${when}): ${url}`);

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-sky px-4 py-3.5">
      <p className="font-semibold">Your follow-up link</p>
      <p className="text-caption text-text-2">
        Come back around <strong className="font-semibold text-ink">{when}</strong>. We don&apos;t ask for your name, so this link is
        the only way back to your follow-up. Keep it private.
      </p>
      <code className="rounded-xl bg-surface px-3 py-2.5 text-small break-all text-ink">{url}</code>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false))}
          className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink bg-surface px-4 text-caption font-medium"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={`https://wa.me/?text=${message}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-ink bg-surface px-4 text-caption font-medium text-ink no-underline hover:text-ink"
        >
          Send to myself<span className="sr-only"> on WhatsApp (opens in a new tab)</span>
        </a>
      </div>
    </div>
  );
}
