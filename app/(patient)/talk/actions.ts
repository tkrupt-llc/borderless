"use server";

import { z } from "zod";
import { isDbConfigured } from "@/lib/db/server";
import { readSessionId, writeSessionId } from "@/lib/db/patient-session";
import * as persist from "@/lib/check/persist";
import { LANGUAGES, CLINICIAN_CHOICES } from "./options";
import { caseRef } from "@/lib/case-ref";
import { checkPhrases } from "@/lib/rules/phrases";
import { loadRuleFile } from "@/lib/rules/load";
import { runSafetyRules } from "@/lib/rules/safety";

const Input = z.object({
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),
  language: z.enum(LANGUAGES),
  clinician: z.enum(CLINICIAN_CHOICES),
  callbackTime: z.string().trim().max(80),
  discreet: z.boolean(),
});

export type CallbackResult =
  | { ok: true; dueAt: string; ref: string }
  | { ok: false; reason: "invalid" | "not_connected" | "error" };

/**
 * A non-urgent request to talk to a person: saves the contact details and
 * creates a call-back task due in one working day. Works with or without a
 * check-in; asking for a call is an explicit request for clinician contact,
 * recorded as such in the consent log.
 */
export async function requestCallback(input: unknown): Promise<CallbackResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!isDbConfigured()) return { ok: false, reason: "not_connected" };
  const d = parsed.data;
  try {
    let id = await readSessionId();
    if (!id || !(await persist.getSession(id))) {
      id = await persist.createSession("contact", d.discreet, { clinician_review: true });
      await writeSessionId(id);
    }
    await persist.saveContact(id, d.phone, d.callbackTime || null, {
      language: d.language,
      clinicianGender: d.clinician === "No preference" ? null : d.clinician,
    });
    const due = await persist.requestCallback(id);
    return { ok: true, dueAt: due.toISOString(), ref: caseRef(id) };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

const MessageInput = z.object({ body: z.string().trim().min(2).max(1000), discreet: z.boolean() });

export type MessageResult =
  | { ok: true; flagged: boolean; ref: string | null }
  | { ok: false; reason: "invalid" | "not_connected" | "error"; flagged: boolean };

/**
 * "Send a message to your care team" (design canvas, Talk to someone). The
 * fixed risk-phrase list runs first, never the AI: a match raises
 * RF-MESSAGE-PHRASE (urgent task, on-call alerted) and the page shows the
 * emergency options, even if saving fails.
 */
export async function sendCareTeamMessage(input: unknown): Promise<MessageResult> {
  const parsed = MessageInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid", flagged: false };
  const { body, discreet } = parsed.data;
  const flagged = checkPhrases(body).matched.length > 0;
  if (!isDbConfigured()) return { ok: false, reason: "not_connected", flagged };
  try {
    let id = await readSessionId();
    const session = id ? await persist.getSession(id) : null;
    if (!id || !session) {
      id = await persist.createSession("contact", discreet, { clinician_review: true });
      await writeSessionId(id);
    }
    await persist.savePatientMessage(id, body, !flagged);
    if (flagged && !session?.taken_over) {
      const fired = runSafetyRules(
        { redFlags: loadRuleFile("red-flags"), bpdAdhd: loadRuleFile("bpd-adhd") },
        { "flag.message_risk_phrase": true },
      ).fired;
      await persist.raiseRedFlags(id, fired, "message to the care team");
    }
    return { ok: true, flagged, ref: caseRef(id) };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error", flagged };
  }
}
