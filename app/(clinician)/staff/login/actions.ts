"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { staffAuthClient } from "@/lib/staff/auth";

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

export async function signOut() {
  await (await staffAuthClient()).auth.signOut();
  redirect("/staff/login");
}
