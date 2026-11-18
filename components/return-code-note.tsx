"use client";

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
  if (!data) return null;
  return (
    <section aria-labelledby="return-h" className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-dashed border-line bg-surface px-4 py-3.5">
      <h2 id="return-h" className="font-semibold">
        Keep these to come back
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-caption text-muted">Reference</dt>
        <dd className="font-semibold tracking-wide tabular-nums">{caseRef(data.sessionId)}</dd>
        <dt className="text-caption text-muted">Return code</dt>
        <dd className="font-semibold tracking-[0.12em] tabular-nums">{data.returnCode}</dd>
      </dl>
      <p className="text-caption text-text-2">
        Write them down or take a screenshot. With both, &ldquo;Coming back?&rdquo; brings your timeline back on any device.
        Keep the code private.
      </p>
    </section>
  );
}
