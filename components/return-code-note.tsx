"use client";

import { useState } from "react";
import { RESULT_KEY, useStoredValue } from "@/lib/check/local-answers";
import { caseRef } from "@/lib/case-ref";

function read(raw: string | null): { sessionId: string; returnCode: string } | null {
  try {
    const r = raw ? JSON.parse(raw) : null;
    return r?.sessionId && r?.returnCode ? { sessionId: r.sessionId, returnCode: r.returnCode } : null;
  } catch {
    return null;
  }
}

/**
 * The reference and return code, so the person can come back after this
 * browser forgets them (a new device, a cleared browser, or Quick exit).
 */
export function ReturnCodeNote() {
  const data = read(useStoredValue(RESULT_KEY));
  const [copied, setCopied] = useState(false);
  if (!data) return null;
  // Only rendered in the browser (the stored result is read after hydration), so window is safe here.
  const address = `${window.location.origin}/return`;
  const ref = caseRef(data.sessionId);
  const both = `Reference: ${ref}\nReturn code: ${data.returnCode}\nCome back at: ${address}`;

  return (
    <section aria-labelledby="return-h" className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-dashed border-line bg-surface px-4 py-3.5">
      <h2 id="return-h" className="font-semibold">
        Keep these to come back
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-caption text-muted">Reference</dt>
        <dd className="font-semibold tracking-wide tabular-nums">{ref}</dd>
        <dt className="text-caption text-muted">Return code</dt>
        <dd className="font-semibold tracking-[0.12em] tabular-nums">{data.returnCode}</dd>
        <dt className="text-caption text-muted">Come back at</dt>
        <dd className="min-w-0 break-all font-medium">{address}</dd>
      </dl>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard.writeText(both).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
        className="tap min-h-11 cursor-pointer self-start rounded-full border-[1.5px] border-ink px-4 text-caption font-medium text-ink"
      >
        {copied ? "Copied" : "Copy both"}
      </button>
      <p className="text-caption text-text-2">
        Keep them in a private note. With both, you can see your timeline on any device: tap{" "}
        <strong className="font-semibold">Coming back?</strong> on the home page, or the key button at the top of any page.
        Keep the code private.
      </p>
    </section>
  );
}
