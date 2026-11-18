"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreCheckIn } from "../check/actions";

const input = "min-h-12 rounded-xl border-[1.5px] border-line bg-surface px-3.5 text-body uppercase tracking-wide";

export function ReturnForm() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const r = await restoreCheckIn({ reference, code }).catch(() => ({ ok: false as const, reason: "error" as const }));
          if (r.ok) return router.push("/check/done/current");
          setError(
            r.reason === "locked"
              ? "Too many tries. Please wait 15 minutes and try again, or use “Talk to someone”."
              : r.reason === "invalid"
                ? "That reference and code don't match. Check both and try again."
                : "Something went wrong. Please try again.",
          );
        });
      }}
      className="flex flex-col gap-4 px-5 pt-5"
    >
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Reference</span>
        <input
          id="return-reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="BL-AF09B5"
          autoComplete="off"
          maxLength={20}
          required
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Return code</span>
        <input
          id="return-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="K7QM-3XRA"
          autoComplete="off"
          maxLength={20}
          required
          className={input}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="tap flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-primary font-semibold text-white disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? "Checking…" : "Show my timeline"}
      </button>
      <p role="status" className="min-h-6 text-caption text-danger">
        {error}
      </p>
      <p className="text-caption text-text-2">
        Lost your code? <Link href="/talk">Talk to someone</Link> and give your reference.
      </p>
    </form>
  );
}
