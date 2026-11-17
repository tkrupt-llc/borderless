"use server";

import { z } from "zod";
import { isDbConfigured } from "@/lib/db/server";
import { readSessionId } from "@/lib/db/patient-session";
import * as persist from "@/lib/check/persist";
import cards from "@/content/coping-cards/cards.json";

const CardId = z.enum(cards.cards.map((c) => c.id) as [string, ...string[]]);

/** Whether this browser has a check-in whose owner agreed to clinician review. */
async function reviewableSession(): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const id = await readSessionId();
  if (!id || !(await persist.getSession(id))) return null;
  const consents = await persist.getConsents(id);
  return consents.clinician_review ? id : null;
}

export async function canTellCareTeam(): Promise<boolean> {
  try {
    return Boolean(await reviewableSession());
  } catch {
    return false;
  }
}

/** Creates a not_helping task so a clinician follows up within one working day. */
export async function tellCareTeam(cardId: string): Promise<{ ok: boolean }> {
  try {
    const card = CardId.parse(cardId);
    const id = await reviewableSession();
    if (!id) return { ok: false };
    await persist.flagNotHelping(id, card);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
