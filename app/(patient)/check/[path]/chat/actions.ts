"use server";

import { z } from "zod";
import { isDbConfigured } from "@/lib/db/server";
import { readSessionId } from "@/lib/db/patient-session";
import * as persist from "@/lib/check/persist";
import { callIntakeModel } from "@/lib/ai/client";
import { runTurn, isAwaitingSafetyAnswer, MAX_MESSAGE_LENGTH, type TurnOutcome } from "@/lib/chat/turn";
import { SAFETY_CHECK } from "@/lib/chat/safety-check";
import { loadRuleFile } from "@/lib/rules/load";
import { runSafetyRules } from "@/lib/rules/safety";
import type { TranscriptMessage } from "@/lib/ai/prompt";

// The chat belongs to the full check-in. Without Supabase keys (tests, early
// deploys) the browser keeps the transcript and sends it with each message.

export type ChatMessageView = { id: string; role: "patient" | "assistant" | "system"; text: string; quickReplies: string[] };
type Fail = { ok: false; reason: "invalid" | "no_session" | "error" };

async function fullSession() {
  const id = await readSessionId();
  if (!id) return null;
  const session = await persist.getSession(id);
  return session && session.path === "full" ? session : null;
}

/** Quick replies are not stored; the only ones that matter on reload are the check question's. */
function toView(m: TranscriptMessage, isLast: boolean): ChatMessageView {
  const quickReplies = isLast && m.role === "system" && m.text === SAFETY_CHECK.question ? SAFETY_CHECK.quickReplies : [];
  return { ...m, quickReplies };
}

export async function loadChat(): Promise<
  { ok: true; messages: ChatMessageView[]; takenOver: boolean; persisted: boolean } | Fail
> {
  if (!isDbConfigured()) return { ok: true, messages: [], takenOver: false, persisted: false };
  try {
    const session = await fullSession();
    if (!session) return { ok: false, reason: "no_session" };
    const transcript = await persist.loadTranscript(session.id);
    return {
      ok: true,
      messages: transcript.map((m, i) => toView(m, i === transcript.length - 1)),
      takenOver: session.taken_over,
      persisted: true,
    };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

const SendInput = z.object({
  text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  // Only used when there is no database.
  transcript: z
    .array(z.object({ id: z.string(), role: z.enum(["patient", "assistant", "system"]), text: z.string() }))
    .max(60)
    .optional(),
});

export type SendResult = { ok: true; outcome: TurnOutcome; patientId: string; messages: ChatMessageView[] } | Fail;

export async function sendChat(input: unknown): Promise<SendResult> {
  const parsed = SendInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { text } = parsed.data;

  // --- No database: run the turn on the transcript the browser sent. ---------
  if (!isDbConfigured()) {
    const transcript = parsed.data.transcript ?? [];
    const patientId = crypto.randomUUID();
    const turn = await runTurn({ transcript, patient: { id: patientId, text }, takenOver: false, callModel: callIntakeModel });
    return {
      ok: true,
      outcome: turn.outcome,
      patientId,
      messages: turn.messages.map((m) => ({ id: crypto.randomUUID(), ...m })),
    };
  }

  // --- With the database: the server's transcript is the only truth. ---------
  let session, transcript, patientId;
  try {
    session = await fullSession();
    if (!session) return { ok: false, reason: "no_session" };
    transcript = await persist.loadTranscript(session.id);
    patientId = await persist.saveMessage(session.id, "patient", text);
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
  const answeringCheck = isAwaitingSafetyAnswer(transcript);

  const turn = await runTurn({
    transcript,
    patient: { id: patientId, text },
    takenOver: session.taken_over,
    callModel: callIntakeModel,
  });

  try {
    if (turn.outcome === "safety_positive") {
      const fired = runSafetyRules(
        { redFlags: loadRuleFile("red-flags"), bpdAdhd: loadRuleFile("bpd-adhd") },
        { "flag.safety_check_positive": true },
      ).fired;
      await persist.raiseRedFlags(session.id, fired, "chat: answer to the direct check question", patientId);
    }
    if (turn.phraseMatches.length > 0 || turn.outcome === "safety_check") {
      await persist.logEvent(session.id, "safety_check_asked", { phrases: turn.phraseMatches, answering: answeringCheck });
    }
    if (answeringCheck && turn.outcome !== "safety_positive") {
      await persist.logEvent(session.id, "safety_check_answered_no", {});
    }
    if (turn.blocked.length > 0) await persist.logEvent(session.id, "ai_reply_blocked", { categories: turn.blocked });
    if (turn.modelFailed) await persist.logEvent(session.id, "ai_unavailable_fallback", {});

    await persist.saveExtracted(session.id, turn.extracted);
    const history = turn.extracted.filter((f) => f.field === "history_bpd_adhd").map((f) => f.value.toLowerCase());
    await persist.markSelfReportedHistory(session.id, {
      bpd: history.some((v) => /\b(bpd|borderline)\b/.test(v)),
      adhd: history.some((v) => /\badhd\b|attention deficit/.test(v)),
    });

    const saved: ChatMessageView[] = [];
    for (const m of turn.messages) saved.push({ id: await persist.saveMessage(session.id, m.role, m.text), ...m });
    return { ok: true, outcome: turn.outcome, patientId, messages: saved };
  } catch (e) {
    console.error(e);
    // The crisis page never waits on a database write: the numbers come first.
    if (turn.outcome === "safety_positive" || turn.outcome === "taken_over") {
      return { ok: true, outcome: turn.outcome, patientId, messages: [] };
    }
    return { ok: false, reason: "error" };
  }
}
