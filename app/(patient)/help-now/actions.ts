"use server";

import { z } from "zod";
import { isDbConfigured } from "@/lib/db/server";
import { readSessionId, writeSessionId } from "@/lib/db/patient-session";
import * as persist from "@/lib/check/persist";
import { loadRuleFile } from "@/lib/rules/load";
import { runSafetyRules } from "@/lib/rules/safety";
import { formatOpening, isStaffed, nextStaffed } from "@/lib/staffing";

const helpNowRules = () =>
  runSafetyRules({ redFlags: loadRuleFile("red-flags"), bpdAdhd: loadRuleFile("bpd-adhd") }, { "flag.help_now": true })
    .fired;
/** "Alert my care team now": an imminent task (15 minutes), not the urgent one opening the page raises. */
const alertRules = () =>
  runSafetyRules({ redFlags: loadRuleFile("red-flags"), bpdAdhd: loadRuleFile("bpd-adhd") }, { "flag.alert_care_team": true })
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
  // Optional: someone may need to alert the team without being able to take a call.
  phone: z.union([z.literal(""), z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "phone")]),
  callbackTime: z.string().trim().max(80).optional(),
  discreet: z.boolean(),
});

export type AlertResult =
  | { ok: true; noContact: boolean; outOfHours: boolean; opensAt: string | null }
  | { ok: false; reason: "invalid" | "not_connected" | "error" };

/**
 * "Alert my care team now": saves a phone number and raises an imminent task (15 minutes).
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
    const phone = parsed.data.phone.trim();
    if (phone) await persist.saveContact(id, phone, parsed.data.callbackTime || null);
    // Always imminent, even if the case already has an urgent task: the person asked
    // for someone now. The rule fires once per case, so a second tap adds no duplicate.
    await persist.raiseRedFlags(id, alertRules(), "asked to alert the care team");
    // Outside staffed hours the imminent task is still raised, and both the person and the console are told.
    const now = new Date();
    const staffed = isStaffed(now);
    // No number, or out of hours: the imminent task says so.
    if (!phone || !staffed) await persist.flagAlertTask(id, { noContact: !phone, outOfHours: !staffed });
    return { ok: true, noContact: !phone, outOfHours: !staffed, opensAt: staffed ? null : formatOpening(nextStaffed(now)) };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}
