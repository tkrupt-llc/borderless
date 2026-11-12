"use server";

import { z } from "zod";
import { isPathId, itemIdsFor, PATHS, type PathId } from "@/lib/check/paths";
import { isValidAnswer } from "@/lib/item-bank";
import { isDbConfigured } from "@/lib/db/server";
import { readSessionId, writeSessionId } from "@/lib/db/patient-session";
import * as persist from "@/lib/check/persist";
import { factsFromAnswers, type Facts } from "@/lib/rules/engine";
import { loadRuleFile } from "@/lib/rules/load";
import { runSafetyRules } from "@/lib/rules/safety";
import { factsFromScores, scoreAll, type Score } from "@/lib/rules/scoring";
import consent from "@/content/consent.json";

// Without Supabase keys (tests, or a deploy before set-up) the flow still runs
// and the rules still fire; nothing is saved.

type Fail = { ok: false; reason: "invalid" | "no_session" | "error" };

// ---------------------------------------------------------------------------
// Consent: creates the anonymous session
// ---------------------------------------------------------------------------

const StartInput = z.object({
  path: z.string(),
  discreet: z.boolean(),
  consents: z.record(z.string(), z.boolean()),
});

export async function startCheckIn(input: unknown): Promise<{ ok: true } | Fail> {
  const parsed = StartInput.safeParse(input);
  if (!parsed.success || !isPathId(parsed.data.path)) return { ok: false, reason: "invalid" };
  const known = new Set(consent.purposes.map((p) => p.id));
  const choices = Object.fromEntries(Object.entries(parsed.data.consents).filter(([k]) => known.has(k)));

  if (!isDbConfigured()) return { ok: true };
  try {
    const id = await persist.createSession(parsed.data.path, parsed.data.discreet, choices);
    await writeSessionId(id);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

// ---------------------------------------------------------------------------
// Choices asked on the result page (follow-up, service improvement)
// ---------------------------------------------------------------------------

const LaterInput = z.object({ path: z.string(), consents: z.record(z.string(), z.boolean()) });

export async function recordLaterConsents(input: unknown): Promise<{ ok: true } | Fail> {
  const parsed = LaterInput.safeParse(input);
  if (!parsed.success || !isPathId(parsed.data.path)) return { ok: false, reason: "invalid" };
  if (!isDbConfigured()) return { ok: true };
  try {
    const session = await currentSession(parsed.data.path);
    if (!session) return { ok: false, reason: "no_session" };
    await persist.addConsents(session.id, "result", parsed.data.consents);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

// ---------------------------------------------------------------------------
// Every answer: safety rules first, then save
// ---------------------------------------------------------------------------

const AnswersInput = z.object({
  path: z.string(),
  answers: z.record(z.string(), z.number().int().min(0).max(3)),
});

function parseAnswers(input: unknown): { path: PathId; answers: Record<string, number> } | null {
  const parsed = AnswersInput.safeParse(input);
  if (!parsed.success || !isPathId(parsed.data.path)) return null;
  const allowed = itemIdsFor(parsed.data.path);
  const answers = Object.fromEntries(Object.entries(parsed.data.answers).filter(([id]) => allowed.has(id)));
  // Every value must be one of its item's options; anything else is refused, never guessed.
  if (!Object.entries(answers).every(([id, value]) => isValidAnswer(id, value))) return null;
  return { path: parsed.data.path, answers };
}

/** The session behind the cookie, if it belongs to this path. */
async function currentSession(path: PathId) {
  const id = await readSessionId();
  if (!id) return null;
  const session = await persist.getSession(id);
  return session && session.path === path ? session : null;
}

export type CheckResult = { ok: true; takeover: boolean } | Fail;

/**
 * Runs the safety rules on every answer, as soon as it is given and before the
 * rest is scored. Deterministic YAML rules, never the AI. A red flag sends the
 * person to the crisis page even if saving fails: the numbers come first.
 */
export async function checkAnswers(input: unknown): Promise<CheckResult> {
  const parsed = parseAnswers(input);
  if (!parsed) return { ok: false, reason: "invalid" };
  const { path, answers } = parsed;

  const run = (history: Facts) =>
    runSafetyRules(
      { redFlags: loadRuleFile("red-flags"), bpdAdhd: loadRuleFile("bpd-adhd") },
      { ...factsFromAnswers(answers), ...factsFromScores(scoreAll(answers)), ...history },
    );

  if (!isDbConfigured()) return { ok: true, takeover: run({}).takeover };

  let session;
  try {
    session = await currentSession(path);
  } catch (e) {
    console.error(e);
    // Can't reach the database: still check for a red flag before refusing.
    return run({}).takeover ? { ok: true, takeover: true } : { ok: false, reason: "error" };
  }
  if (!session) return run({}).takeover ? { ok: true, takeover: true } : { ok: false, reason: "no_session" };

  const result = run({ "history.bpd": session.history_bpd, "history.adhd": session.history_adhd });
  try {
    await persist.saveAnswers(session.id, answers);
    await persist.raiseRedFlags(session.id, result.fired, "questionnaire answer");
  } catch (e) {
    console.error(e);
    if (!result.takeover) return { ok: false, reason: "error" };
  }
  return { ok: true, takeover: result.takeover };
}

// ---------------------------------------------------------------------------
// Last answer: score, store, and hand to a clinician (with consent)
// ---------------------------------------------------------------------------

export type FinishResult =
  | { ok: true; sessionId: string | null; scores: Score[]; sentToClinician: boolean }
  | Fail;

export async function finishCheckIn(input: unknown): Promise<FinishResult> {
  const parsed = parseAnswers(input);
  if (!parsed) return { ok: false, reason: "invalid" };
  const { path, answers } = parsed;
  if (Object.keys(answers).length !== itemIdsFor(path).size) return { ok: false, reason: "invalid" };

  const instruments = new Set<string>(PATHS[path]);
  const scores = scoreAll(answers).filter((s) => instruments.has(s.instrument));
  if (!isDbConfigured()) return { ok: true, sessionId: null, scores, sentToClinician: false };

  try {
    const session = await currentSession(path);
    if (!session) return { ok: false, reason: "no_session" };
    const consents = await persist.getConsents(session.id);
    const sentToClinician = consents.clinician_review === true;
    await persist.finishCheckIn(session.id, scores, sentToClinician);
    return { ok: true, sessionId: session.id, scores, sentToClinician };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}
