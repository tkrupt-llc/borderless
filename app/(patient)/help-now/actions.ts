"use server";

import { z } from "zod";
import { isDbConfigured } from "@/lib/db/server";
import { readSessionId, writeSessionId } from "@/lib/db/patient-session";
import * as persist from "@/lib/check/persist";
import { loadRuleFile } from "@/lib/rules/load";
import { runSafetyRules } from "@/lib/rules/safety";

const helpNowRules = () =>
  runSafetyRules({ redFlags: loadRuleFile("red-flags"), bpdAdhd: loadRuleFile("bpd-adhd") }, { "flag.help_now": true })
    .fired;

/**
 * The crisis page was opened during a check-in: raise RF-HELP-NOW (urgent task)
 * for that session. Skipped if the session is already taken over, since a rule
 * that sent the person here has already raised its own task.
 */
export async function helpNowOpened(): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    const id = await readSessionId();
    if (!id) return;
    const session = await persist.getSession(id);
    if (!session || session.taken_over) return;
    await persist.raiseRedFlags(id, helpNowRules(), "pressed I need help now");
  } catch (e) {
    console.error(e);
  }
}

const AlertInput = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "phone"),
  callbackTime: z.string().trim().max(80).optional(),
  discreet: z.boolean(),
});

export type AlertResult = { ok: true } | { ok: false; reason: "invalid" | "not_connected" | "error" };

/**
 * "Alert my care team now": saves a phone number and raises an urgent task.
 * Creates a crisis session if the person has none: asking for contact is an
 * explicit request for clinician contact, recorded as such in the consent log.
 */
export async function alertCareTeam(input: unknown): Promise<AlertResult> {
  const parsed = AlertInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!isDbConfigured()) return { ok: false, reason: "not_connected" };

  try {
    let id = await readSessionId();
    const session = id ? await persist.getSession(id) : null;
    if (!id || !session) {
      id = await persist.createSession("crisis", parsed.data.discreet, { clinician_review: true });
      await writeSessionId(id);
    }
    await persist.saveContact(id, parsed.data.phone, parsed.data.callbackTime || null);
    // Already taken over: an urgent task exists, so the phone number joins that case
    // instead of opening a second task for the same person.
    if (!session?.taken_over) await persist.raiseRedFlags(id, helpNowRules(), "asked to alert the care team");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}
