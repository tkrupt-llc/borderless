"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

const input = "min-h-12 rounded-lg border-[1.5px] border-line bg-surface px-3 text-body";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Email</span>
        <input name="email" type="email" autoComplete="username" required defaultValue={state?.email ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-primary px-6 font-medium text-white disabled:cursor-wait"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p role="alert" className="min-h-6 text-caption text-danger">
        {state?.error ?? ""}
      </p>
    </form>
  );
}
