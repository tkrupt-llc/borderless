"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { staffAuthClient } from "@/lib/staff/auth";
import { db } from "@/lib/db/server";

const Input = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(200) });

export type SignInState = { error: string; email: string } | null;

/** Returns the email on failure so the form can keep it (React clears a form after its action runs). */
export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "");
  const parsed = Input.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password.", email };
  const supabase = await staffAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  const role = data.user?.app_metadata?.role;
  if (error || !["clinician", "supervisor", "judge"].includes(role)) {
    if (!error) await supabase.auth.signOut(); // signed in, but not a staff account
    return { error: "That email or password is not right.", email };
  }
  redirect("/staff");
}

const GUEST_EMAIL = "guest@borderless.demo";

/**
 * "Continue as guest": signs in to the shared guest account (supervisor rights, demo cases only;
 * see lib/staff/scope.ts). There is no guest password: the server makes a one-time sign-in link
 * with the service key and exchanges it straight away for a session cookie.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the form state hook passes the previous state
export async function continueAsGuest(_prev: SignInState): Promise<SignInState> {
  const { data, error } = await db().auth.admin.generateLink({ type: "magiclink", email: GUEST_EMAIL });
  const tokenHash = data?.properties?.hashed_token;
  const isGuest = data?.user?.app_metadata?.demo === true;
  if (error || !tokenHash || !isGuest) return { error: "Guest access isn't available right now.", email: "" };
  const { error: verifyError } = await (await staffAuthClient()).auth.verifyOtp({ type: "email", token_hash: tokenHash });
  if (verifyError) return { error: "Guest access isn't available right now.", email: "" };
  redirect("/staff");
}

export async function signOut() {
  await (await staffAuthClient()).auth.signOut();
  redirect("/staff/login");
}
