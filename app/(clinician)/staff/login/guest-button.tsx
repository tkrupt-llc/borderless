"use client";

import { useActionState } from "react";
import { continueAsGuest } from "./actions";

/** "Continue as guest": the shared demo account. Supervisor rights, demo cases only, reset daily. */
export function GuestButton() {
  const [state, action, pending] = useActionState(continueAsGuest, null);
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-line pt-5">
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-ink bg-surface px-6 font-medium text-ink disabled:cursor-wait"
      >
        {pending ? "Opening the demo…" : "Continue as guest"}
      </button>
      <p className="text-caption text-text-2">
        Try the console with supervisor rights on demo cases only. Nothing real is shown, and the demo cases reset every day.
      </p>
      <p role="alert" className="min-h-6 text-caption text-danger">
        {state?.error ?? ""}
      </p>
    </form>
  );
}
