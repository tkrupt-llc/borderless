"use server";

import { isDbConfigured } from "@/lib/db/server";
import { writeSessionId } from "@/lib/db/patient-session";
import * as persist from "@/lib/check/persist";
import { TOKEN_PATTERN } from "@/lib/followup/trend";

/** Opens a follow-up check-in from the private link: a new session linked to the first one. */
export async function startFollowUp(token: string): Promise<{ ok: true } | { ok: false; reason: "invalid" | "error" }> {
  if (!TOKEN_PATTERN.test(token) || !isDbConfigured()) return { ok: false, reason: "invalid" };
  try {
    const root = await persist.findFollowUpRoot(token);
    if (!root) return { ok: false, reason: "invalid" };
    const id = await persist.createFollowUpSession(root.id);
    await writeSessionId(id);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}
