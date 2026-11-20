import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Staff sign in with Supabase Auth. The role lives in app_metadata, which only
// the service role can set (scripts/seed-staff.ts). Every staff page and action
// calls requireStaff(); data is then read with the server-only service client.

export type StaffRole = "clinician" | "supervisor" | "judge";
/** demo: the guest account, which only ever sees demo cases (see lib/staff/scope.ts). */
export type Staff = { id: string; email: string; role: StaffRole; demo: boolean };
const ROLES: readonly string[] = ["clinician", "supervisor", "judge"];

export async function staffAuthClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called while rendering a page, where cookies are read-only. proxy.ts refreshes them.
        }
      },
    },
  });
}

export async function getStaff(): Promise<Staff | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  // Staff pages are always rendered per request (the auth client reads the clock).
  await connection();
  // getClaims checks the token's signature locally (no trip to the auth server
  // when the project signs tokens with asymmetric keys; otherwise it asks the server).
  const { data } = await (await staffAuthClient()).auth.getClaims();
  const claims = data?.claims;
  const role = claims?.app_metadata?.role;
  if (!claims?.sub || typeof role !== "string" || !ROLES.includes(role)) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    role: role as StaffRole,
    demo: claims.app_metadata?.demo === true,
  };
}

export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/staff/login");
  return staff;
}

/** Judges can look at everything but change nothing. */
export function canWrite(staff: Staff): boolean {
  return staff.role === "clinician" || staff.role === "supervisor";
}
