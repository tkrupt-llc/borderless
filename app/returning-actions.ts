"use server";

import { isDbConfigured } from "@/lib/db/server";
import { clearSessionId, readSessionId } from "@/lib/db/patient-session";
import * as persist from "@/lib/check/persist";

/**
 * Whether this browser holds a valid patient cookie (it points at a check-in
 * that still exists). Only a yes or no: nothing about the check-in is returned.
 */
export async function returningVisitor(): Promise<{ show: boolean }> {
  if (!isDbConfigured()) return { show: false };
  try {
    const id = await readSessionId();
    if (!id) return { show: false };
    return { show: Boolean(await persist.getSession(id)) };
  } catch (e) {
    console.error(e);
    return { show: false };
  }
}

/** "Not me": forget this browser's check-in, the same clearing as Quick exit. */
export async function notMe(): Promise<{ ok: true }> {
  await clearSessionId();
  return { ok: true };
}
