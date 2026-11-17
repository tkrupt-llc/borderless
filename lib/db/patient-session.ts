import "server-only";
import { cookies } from "next/headers";
import { CLINIC_COOKIE } from "@/lib/clinics";

// Anonymous start: no account. The session id lives in an httpOnly cookie that
// page scripts cannot read; only server actions and route handlers use it.
// It ends when the browser closes (or after 7 days if the person pauses a
// check-in to finish later), and Quick exit deletes it (app/api/exit).
export const SESSION_COOKIE = "bl_sid";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readSessionId(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value && UUID.test(value) ? value : null;
}

/**
 * Patient cookies also work when the check-in is embedded on a clinic's website
 * (an iframe on another site): SameSite=None so the browser sends them in that
 * frame, and Partitioned (CHIPS) so they are kept separately for each site that
 * embeds us and can't be used to follow anyone across sites. Server actions
 * still check the request's origin, so None does not open them to other sites.
 */
export const patientCookie = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  partitioned: true,
  path: "/",
};

export async function writeSessionId(id: string, keepDays?: number): Promise<void> {
  // Only "Pause and finish later" keeps the cookie past closing the browser (7 days); Quick exit still deletes it.
  (await cookies()).set(SESSION_COOKIE, id, keepDays ? { ...patientCookie, maxAge: keepDays * 86_400 } : patientCookie);
}

export async function clearSessionId(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { ...patientCookie, maxAge: 0 });
}

/** The clinic whose website this check-in started from, if any (set by /embed/[clinicId]). */
export async function readClinicId(): Promise<string | null> {
  return (await cookies()).get(CLINIC_COOKIE)?.value ?? null;
}
