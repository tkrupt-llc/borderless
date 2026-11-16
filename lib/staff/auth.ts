import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Staff sign in with Supabase Auth. The role lives in app_metadata, which only
// the service role can set (scripts/seed-staff.ts). Every staff page and action
// calls requireStaff(); data is then read with the server-only service client.

export type StaffRole = "clinician" | "supervisor" | "judge";
export type Staff = { id: string; email: string; role: StaffRole };
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
  const { data } = await (await staffAuthClient()).auth.getUser();
  const role = data.user?.app_metadata?.role;
  if (!data.user || typeof role !== "string" || !ROLES.includes(role)) return null;
  return { id: data.user.id, email: data.user.email ?? "", role: role as StaffRole };
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
