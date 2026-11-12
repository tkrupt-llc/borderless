import "server-only";
import { cookies } from "next/headers";

// Anonymous start: no account. The session id lives in an httpOnly cookie that
// page scripts cannot read; only server actions and route handlers use it.
// It ends when the browser closes, and Quick exit deletes it (app/api/exit).
export const SESSION_COOKIE = "bl_sid";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readSessionId(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value && UUID.test(value) ? value : null;
}

export async function writeSessionId(id: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSessionId(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
