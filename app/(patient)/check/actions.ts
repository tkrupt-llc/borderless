"use server";

import { z } from "zod";
import { isPathId, itemIdsFor, PATHS, stepsFor, type PathId } from "@/lib/check/paths";
import { allAskedAnswered, isAsked } from "@/lib/check/conditions";
import { canSkip, SKIPPED, splitSkips } from "@/lib/check/skip";
import { isValidAnswer } from "@/lib/item-bank";
import { isDbConfigured } from "@/lib/db/server";
import { readSessionId, writeSessionId } from "@/lib/db/patient-session";
import * as persist from "@/lib/check/persist";
import { factsFromAnswers, type Facts } from "@/lib/rules/engine";
import { loadRuleFile } from "@/lib/rules/load";
import { runSafetyRules } from "@/lib/rules/safety";
import { proposeStep } from "@/lib/rules/routing";
import { buildReceipt, type ReceiptView } from "@/lib/receipt/build";
import { caseRef } from "@/lib/case-ref";
import { factsFromScores, scoreAll, type Score } from "@/lib/rules/scoring";
import { CHANNELS, channelPurpose, may, purposesFor } from "@/lib/consent";
import { CONDITION_IDS } from "@/lib/physical-health";
import aboutYou from "@/content/about-you.json";
import { applyFollowUps, latestReferral, patientAnswer, toReferral } from "@/lib/referral/persist";
import { patientCard } from "@/lib/referral/followup";
import { serviceById } from "@/lib/directory";
import { derivedScreens, notOnTrack } from "@/lib/followup/trend";

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
  // Follow-ups and the safety questions start from their own entry points, not this consent screen.
  if (!parsed.success || !isPathId(parsed.data.path) || parsed.data.path === "followup" || parsed.data.path === "safety") {
    return { ok: false, reason: "invalid" };
  }
  const path = parsed.data.path;
  const known = new Set(purposesFor("start", path).map((p) => p.id));
  const choices = Object.fromEntries(Object.entries(parsed.data.consents).filter(([k]) => known.has(k)));
  // Care-team access is required to use the check-in (challenge brief).
  if (choices.clinician_review !== true) return { ok: false, reason: "invalid" };

  if (!isDbConfigured()) return { ok: true };
  try {
    const id = await persist.createSession(path, parsed.data.discreet, choices);
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

export async function recordLaterConsents(input: unknown): Promise<{ ok: true; followUpToken?: string } | Fail> {
  const parsed = LaterInput.safeParse(input);
  if (!parsed.success || !isPathId(parsed.data.path)) return { ok: false, reason: "invalid" };
  if (!isDbConfigured()) return { ok: true };
  try {
    const session = await currentSession(parsed.data.path);
    if (!session) return { ok: false, reason: "no_session" };
    await persist.addConsents(session.id, "result", parsed.data.consents);
    // Saying yes to a follow-up gives the person their private link back.
    if (parsed.data.consents.follow_up === true) return { ok: true, followUpToken: await persist.ensureFollowUpToken(session.id) };
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

// ---------------------------------------------------------------------------
// The receipt timeline, for the session behind this browser's cookie only
// ---------------------------------------------------------------------------

/** null when there is nothing on the server to show (no database, no session, or no clinician review). */
export async function loadReceipt(): Promise<ReceiptView | null> {
  if (!isDbConfigured()) return null;
  try {
    // The cookie, never an id from the URL, decides whose receipt this is.
    const id = await readSessionId();
    if (!id) return null;
    // Hand-off rules for this case run here too, so the card is current without a cron job.
    await applyFollowUps(id).catch((e) => console.error(e));
    const [data, messages, handoff] = await Promise.all([persist.loadReceiptData(id), persist.loadPatientMessages(id), latestReferral(id)]);
    const view = buildReceipt(data);
    const service = handoff ? serviceById(handoff.service_id) : undefined;
    const referral =
      handoff && service && handoff.status !== "closed"
        ? {
            service: { name: service.name, kind: service.kind, mode: service.mode, booking: service.booking, about: service.about },
            status: handoff.status,
            bookedFor: handoff.booked_for,
            card: patientCard(toReferral(handoff), new Date()),
          }
        : null;
    if (view) return { ...view, ref: caseRef(id), messages, referral };
    // No check-in, only messages ("Talk to someone"): show the conversation on its own.
    return messages.length > 0 ? { sentAt: messages[0].at, steps: [], ref: caseRef(id), messages } : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Every answer: safety rules first, then save
// ---------------------------------------------------------------------------

const AnswersInput = z.object({
  path: z.string(),
  // -1 is "Prefer not to say" (lib/check/skip.ts); only allowed on non-safety questions.
  answers: z.record(z.string(), z.number().int().min(SKIPPED).max(3)),
});

type ParsedAnswers = {
  path: PathId;
  /** Real answers only: what the rules read and what is scored. */
  answers: Record<string, number>;
  /** Real answers plus skips: what is stored and what counts as "asked". */
  all: Record<string, number>;
};

function parseAnswers(input: unknown): ParsedAnswers | null {
  const parsed = AnswersInput.safeParse(input);
  if (!parsed.success || !isPathId(parsed.data.path)) return null;
  const allowed = itemIdsFor(parsed.data.path);
  const all = Object.fromEntries(Object.entries(parsed.data.answers).filter(([id]) => allowed.has(id)));
  // Every value must be one of its item's options (or a skip where skipping is allowed); anything else is refused, never guessed.
  if (!Object.entries(all).every(([id, value]) => (value === SKIPPED ? canSkip(id) : isValidAnswer(id, value)))) return null;
  return { path: parsed.data.path, answers: splitSkips(all).answers, all };
}

/**
 * The session behind the cookie, if it belongs to this path. The safety
 * questions belong to whatever case the person already has (so a red flag in
 * a quick check escalates the same case), or to the crisis case they started.
 */
async function currentSession(path: PathId) {
  const id = await readSessionId();
  if (!id) return null;
  const session = await persist.getSession(id);
  if (path === "safety") return session;
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
  const { path, answers, all } = parsed;

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
    await persist.saveAnswers(session.id, all);
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
  | { ok: true; sessionId: string | null; scores: Score[]; sentToClinician: boolean; returnCode?: string }
  | Fail;

export async function finishCheckIn(input: unknown): Promise<FinishResult> {
  const parsed = parseAnswers(input);
  if (!parsed) return { ok: false, reason: "invalid" };
  const { path, answers, all } = parsed;
  // Conditional questions (ASQ / C-SSRS): every question that should have been asked is answered (or skipped, where allowed).
  const ordered = stepsFor(path).map((st) => st.item.id);
  if (!allAskedAnswered(ordered, all)) return { ok: false, reason: "invalid" };

  const instruments = new Set<string>(PATHS[path]);
  const scores = scoreAll(answers).filter((s) => instruments.has(s.instrument));
  // A follow-up also stores PHQ-2 / GAD-2 (its first two items), so it can be compared with a quick check.
  const saved = path === "followup" ? [...scores, ...derivedScreens(answers)] : scores;
  if (!isDbConfigured()) return { ok: true, sessionId: null, scores, sentToClinician: false };

  try {
    const session = await currentSession(path);
    if (!session) return { ok: false, reason: "no_session" };
    if (path === "safety") {
      // The red flags were raised answer by answer; this only stores the screen.
      await persist.finishSafetyScreen(session.id, saved);
      return { ok: true, sessionId: session.id, scores, sentToClinician: true, returnCode: await persist.issueReturnCode(session.id) };
    }
    const consents = await persist.getConsents(session.id);
    const sentToClinician = consents.clinician_review === true;
    // Stepped-care proposal from the routing rules; a clinician accepts or overrides it.
    const proposal = proposeStep(loadRuleFile("routing"), {
      ...factsFromAnswers(answers),
      ...factsFromScores(scores),
      "path.quick": path === "quick",
      "field.medical_conditions": await persist.hasExtractedField(session.id, "medical_conditions"),
    });
    await persist.finishCheckIn(session.id, saved, sentToClinician, proposal);
    if (path === "followup" && sentToClinician) {
      // Compare with the check-in before this one; a reliable worsening goes to the care team.
      const { points } = await persist.loadTrend(session.id);
      const earlier = points.filter((p) => p.sessionId !== session.id);
      const lastId = earlier.at(-1)?.sessionId;
      const reasons = notOnTrack(earlier.filter((p) => p.sessionId === lastId), saved);
      if (reasons.length > 0) await persist.raiseNotOnTrack(session.id, reasons);
    }
    // Shown once: with the reference, it brings this check-in back after the browser forgets it.
    const returnCode = await persist.issueReturnCode(session.id);
    return { ok: true, sessionId: session.id, scores, sentToClinician, returnCode };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

// ---------------------------------------------------------------------------
// Follow-up trend, for the session behind this browser's cookie only
// ---------------------------------------------------------------------------

export type MyTrend = { points: { at: string; instrument: string; total: number; band: string }[]; checkIns: number };

export async function loadMyTrend(): Promise<MyTrend | null> {
  if (!isDbConfigured()) return null;
  try {
    const id = await readSessionId();
    if (!id) return null;
    const { points, sessions } = await persist.loadTrend(id);
    return { points: points.map(({ at, instrument, total, band }) => ({ at, instrument, total, band })), checkIns: sessions.length };
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Safety questions from the crisis page
// ---------------------------------------------------------------------------

/**
 * Uses the person's current case if this browser has one; otherwise opens a
 * crisis case. Choosing to answer is a request for the on-call clinician to
 * see the answers, recorded as clinician-review consent.
 */
export async function startSafetyScreen(): Promise<{ ok: true } | Fail> {
  if (!isDbConfigured()) return { ok: true };
  try {
    const id = await readSessionId();
    if (id && (await persist.getSession(id))) return { ok: true };
    const created = await persist.createSession("crisis", false, { clinician_review: true });
    await writeSessionId(created);
    // Same as opening the crisis page during a check-in: RF-HELP-NOW, so a
    // clinician follows up even if every safety answer is "no".
    const fired = runSafetyRules({ redFlags: loadRuleFile("red-flags"), bpdAdhd: loadRuleFile("bpd-adhd") }, { "flag.help_now": true }).fired;
    await persist.raiseRedFlags(created, fired, "opened the crisis page");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

// ---------------------------------------------------------------------------
// Pause and finish later
// ---------------------------------------------------------------------------

/** Keeps this check-in for 7 days so the person can finish it later on this device. */
export async function pauseCheckIn(): Promise<{ ok: boolean }> {
  if (!isDbConfigured()) return { ok: false };
  try {
    const id = await readSessionId();
    if (!id) return { ok: false };
    await writeSessionId(id, 7);
    await persist.markPaused(id);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false };
  }
}

export type InProgress = { path: PathId; answers: Record<string, number>; answered: number; resumeHref: string };

/** The unfinished check-in behind this browser's cookie, with the answers saved so far. */
export async function loadInProgress(): Promise<InProgress | null> {
  if (!isDbConfigured()) return null;
  try {
    const id = await readSessionId();
    if (!id) return null;
    const found = await persist.loadInProgress(id);
    if (!found || !isPathId(found.path) || (found.path as string) === "safety") return null;
    const ids = stepsFor(found.path).map((st) => st.item.id);
    const answered = ids.filter((i) => found.answers[i] !== undefined).length;
    // The full check-in opens with the conversation; until a question is answered, resume there.
    if (found.path === "full" && answered === 0 && may.useAi(await persist.getConsents(id)))
      return { path: found.path, answers: {}, answered, resumeHref: "/check/full/chat" };
    const next = ids.findIndex((i) => isAsked(i, found.answers) && found.answers[i] === undefined);
    const step = next === -1 ? ids.length : next + 1;
    return { path: found.path, answers: found.answers, answered, resumeHref: `/check/${found.path}/${step}` };
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// How should we contact you · How did that feel?
// ---------------------------------------------------------------------------

const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const ContactInput = z
  .object({
    method: z.enum(["phone", "sms", "whatsapp", "email"]),
    address: z.string().trim().max(200),
    times: z.array(z.enum(["weekday_mornings", "weekday_evenings", "weekends", "any_time"])).max(4),
    leaveMessage: z.boolean().nullable(),
  })
  .refine((d) => (d.method === "email" ? z.email().safeParse(d.address).success : PHONE.test(d.address)));

export async function saveContactPreferences(input: unknown): Promise<{ ok: true } | Fail> {
  const parsed = ContactInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!isDbConfigured()) return { ok: true };
  try {
    const id = await readSessionId();
    if (!id) return { ok: false, reason: "no_session" };
    await persist.saveContactPrefs(id, parsed.data);
    // One consent per channel: the chosen one on, the others off (changeable later on "See or delete your data").
    await persist.addConsents(id, "contact", Object.fromEntries(CHANNELS.map((c) => [channelPurpose(c), c === parsed.data.method])));
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

export async function recordFeeling(feeling: unknown): Promise<{ ok: boolean }> {
  const parsed = z.enum(["easy", "ok", "hard"]).safeParse(feeling);
  if (!parsed.success || !isDbConfigured()) return { ok: false };
  try {
    const id = await readSessionId();
    if (!id) return { ok: false };
    await persist.saveFeeling(id, parsed.data);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Physical health (optional, consented)
// ---------------------------------------------------------------------------

const HealthInput = z.object({
  physicalHealth: z.boolean(),
  gpSharing: z.boolean(),
  conditions: z.array(z.enum(CONDITION_IDS)).max(CONDITION_IDS.length),
  other: z.string().trim().max(200),
});

export async function savePhysicalHealth(input: unknown): Promise<{ ok: true } | Fail> {
  const parsed = HealthInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!isDbConfigured()) return { ok: true };
  const d = parsed.data;
  try {
    const id = await readSessionId();
    if (!id) return { ok: false, reason: "no_session" };
    await persist.addConsents(id, "health", { physical_health: d.physicalHealth, gp_sharing: d.gpSharing });
    await persist.savePhysicalHealth(id, d.physicalHealth, d.conditions, d.other || null);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

// ---------------------------------------------------------------------------
// "Your next step": the patient's answers about the hand-off
// ---------------------------------------------------------------------------

const ReferralAnswer = z.discriminatedUnion("answer", [
  z.object({ answer: z.literal("booked"), bookedFor: z.iso.date() }),
  z.object({ answer: z.enum(["not_yet", "help", "attended", "not_attended"]) }),
]);

export async function answerReferral(input: unknown): Promise<{ ok: true } | Fail> {
  const parsed = ReferralAnswer.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!isDbConfigured()) return { ok: false, reason: "error" };
  try {
    const id = await readSessionId();
    if (!id) return { ok: false, reason: "no_session" };
    const row = await latestReferral(id);
    if (!row || row.status === "closed") return { ok: false, reason: "invalid" };
    const d = parsed.data;
    await patientAnswer(row, d.answer, d.answer === "booked" ? d.bookedFor : undefined);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

// ---------------------------------------------------------------------------
// "About you" (optional): only with the anonymous-statistics consent
// ---------------------------------------------------------------------------

export async function saveAboutYou(input: unknown): Promise<{ ok: true } | Fail> {
  const parsed = z.record(z.string(), z.string().nullable()).safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  // Only known questions, and only their listed answers; anything else is dropped.
  const answers: Record<string, string | null> = {};
  for (const q of aboutYou.questions) {
    const v = parsed.data[q.id];
    answers[q.column] = typeof v === "string" && q.options.includes(v) ? v : null;
  }
  if (!isDbConfigured()) return { ok: true };
  try {
    const id = await readSessionId();
    if (!id) return { ok: false, reason: "no_session" };
    if (!may.countInStats(await persist.getConsents(id))) return { ok: false, reason: "invalid" };
    await persist.saveAboutYou(id, answers);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

// ---------------------------------------------------------------------------
// "Coming back?": restore a check-in with its reference and return code
// ---------------------------------------------------------------------------

export async function restoreCheckIn(input: unknown): Promise<{ ok: true } | { ok: false; reason: "invalid" | "locked" | "error" }> {
  const parsed = z.object({ reference: z.string().max(20), code: z.string().max(20) }).safeParse(input);
  if (!parsed.success || !isDbConfigured()) return { ok: false, reason: "invalid" };
  try {
    const r = await persist.verifyReturnCode(parsed.data.reference, parsed.data.code);
    if (!r.ok) return r;
    await writeSessionId(r.sessionId);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}
