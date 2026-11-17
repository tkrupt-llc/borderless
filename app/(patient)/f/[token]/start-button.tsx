"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearAnswers } from "@/lib/check/local-answers";
import { startFollowUp } from "../actions";

export function StartButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<"invalid" | "error" | null>(null);

  if (failed === "invalid") {
    return (
      <p role="alert" className="rounded-2xl bg-surface px-4 py-3.5 text-text-2">
        This follow-up link isn&apos;t valid. Check you copied all of it, or <Link href="/start">start a new check-in</Link>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await startFollowUp(token).catch(() => ({ ok: false as const, reason: "error" as const }));
            if (r.ok) {
              clearAnswers("followup");
              router.push("/check/followup/1");
            } else setFailed(r.reason);
          })
        }
        className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-primary px-6 font-medium text-white disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Starting…" : "Start my follow-up"}
      </button>
      {failed === "error" && (
        <p role="alert" className="text-caption text-danger">
          That didn&apos;t start. Please try again in a moment.
        </p>
      )}
    </div>
  );
}
