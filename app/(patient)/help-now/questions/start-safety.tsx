"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearAnswers } from "@/lib/check/local-answers";
import { startSafetyScreen } from "../../check/actions";

export function StartSafety() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await startSafetyScreen().catch(() => ({ ok: false as const, reason: "error" as const }));
            if (!r.ok) return setFailed(true);
            clearAnswers("safety");
            router.push("/check/safety/1");
          })
        }
        className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-primary px-6 font-medium text-white disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Starting…" : "Start the questions"}
      </button>
      {failed && (
        <p role="alert" className="text-caption text-danger">
          That didn&apos;t start. Please try again, or use the call buttons.
        </p>
      )}
    </div>
  );
}
