"use server";

import { isDbConfigured } from "@/lib/db/server";
import { clearSessionId, readSessionId } from "@/lib/db/patient-session";
import * as persist from "@/lib/check/persist";
import { caseRef } from "@/lib/case-ref";
import { z } from "zod";
import { canChangeLater, isPurpose, PURPOSES } from "@/lib/consent";

export type MyDataStatus = { connected: boolean; ref: string | null };

/** Whether this browser holds a check-in, and its reference. */
export async function myDataStatus(): Promise<MyDataStatus> {
  if (!isDbConfigured()) return { connected: false, ref: null };
  try {
    const id = await readSessionId();
    if (!id || !(await persist.getSession(id))) return { connected: true, ref: null };
    return { connected: true, ref: caseRef(id) };
  } catch {
    return { connected: false, ref: null };
  }
}

export async function deleteMyData(): Promise<{ result: "deleted" | "held" | "none" | "error" }> {
  try {
    const id = await readSessionId();
    if (!id || !(await persist.getSession(id))) return { result: "none" };
    const result = await persist.deleteSessionData(id);
    if (result === "deleted") await clearSessionId();
    return { result };
  } catch {
    return { result: "error" };
  }
}

// ---------------------------------------------------------------------------
// Your choices: granular, revocable consent
// ---------------------------------------------------------------------------

export type MyChoices = { connected: boolean; choices: { id: string; title: string; explanation: string; granted: boolean; changeable: boolean }[] };

/** The latest choice for every purpose, for the check-in behind this browser's cookie. */
export async function loadMyChoices(): Promise<MyChoices> {
  if (!isDbConfigured()) return { connected: false, choices: [] };
  const id = await readSessionId();
  if (!id) return { connected: false, choices: [] };
  const current = await persist.getConsents(id);
  return {
    connected: true,
    choices: PURPOSES.map((p) => ({
      id: p.id,
      title: p.title,
      explanation: p.explanation,
      granted: current[p.id] === true,
      changeable: canChangeLater(p.id),
    })),
  };
}

/**
 * Changes one choice. Appends to the consent log and writes an audit line, so
 * the care team sees the change. Care-team access can't be switched off here:
 * deleting your data is how you withdraw it. Revoking takes effect at once
 * (contact channels, AI help, GP summary, physical health and statistics all
 * read the latest choice).
 */
export async function changeMyChoice(purpose: unknown, granted: unknown): Promise<{ ok: boolean }> {
  const parsed = z.object({ purpose: z.string(), granted: z.boolean() }).safeParse({ purpose, granted });
  if (!parsed.success || !isPurpose(parsed.data.purpose) || !canChangeLater(parsed.data.purpose)) return { ok: false };
  if (!isDbConfigured()) return { ok: false };
  try {
    const id = await readSessionId();
    if (!id) return { ok: false };
    await persist.changeConsent(id, parsed.data.purpose, parsed.data.granted);
    // Withdrawing physical-health consent also removes what was shared.
    if (parsed.data.purpose === "physical_health" && !parsed.data.granted) await persist.savePhysicalHealth(id, false, [], null);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false };
  }
}
