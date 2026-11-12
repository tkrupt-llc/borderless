import type { ExtractedField } from "@/lib/contracts/ai-output";
import type { ChatMessage, ModelResult } from "@/lib/ai/client";
import { guardTurn, type GuardrailCategory } from "@/lib/ai/guardrails";
import { buildMessages, type TranscriptMessage } from "@/lib/ai/prompt";
import { checkPhrases } from "@/lib/rules/phrases";
import {
  AI_DISCLOSURE,
  HELP_ENCOURAGEMENT,
  SAFETY_CHECK,
  asksIfHuman,
  mentionsGettingHelp,
  readSafetyAnswer,
} from "./safety-check";

/**
 * One chat turn. Order (tech spec, Day 4), every step outside the model except 5:
 *   1. session already taken over by a red flag -> the AI is never called again
 *   2. answering the direct check question -> anything but a clear "no" is a red flag
 *   3. phrase check on the patient's message -> direct check question, no AI
 *   4. turn limit -> hand over to the questionnaire
 *   5. call the model (one retry inside); failure -> hand over to the questionnaire
 *   6. guardrails on the reply and quick replies
 *   7. the model's risk flag, or a phrase in what it extracted -> direct check question
 * Pure: the model call is passed in, so every path is testable without the API.
 */

export const MAX_PATIENT_TURNS = 8;
export const MAX_MESSAGE_LENGTH = 1000;

export const HANDOFF_MESSAGE =
  "Thank you. That gives your clinician a good picture. Next are some short questions, one at a time.";
export const FALLBACK_MESSAGE =
  "Sorry, I can't continue the conversation right now. Let's move on to some short questions instead. Your clinician will see everything you have written.";

export type OutMessage = { role: "assistant" | "system"; text: string; quickReplies: string[] };

export type TurnOutcome =
  | "reply" // normal AI reply
  | "safety_check" // the direct check question was asked
  | "safety_positive" // red flag: go to the crisis page
  | "handoff" // move on to the questionnaire
  | "taken_over"; // session already taken over

export type TurnResult = {
  outcome: TurnOutcome;
  messages: OutMessage[];
  extracted: ExtractedField[];
  /** Phrases matched in the patient's text or in what the model extracted. */
  phraseMatches: string[];
  blocked: GuardrailCategory[];
  modelFailed: boolean;
};

type CallModel = (messages: ChatMessage[], patientMessageIds: ReadonlySet<string>) => Promise<ModelResult>;

const empty = { extracted: [], phraseMatches: [], blocked: [], modelFailed: false };
const system = (text: string, quickReplies: string[] = []): OutMessage => ({ role: "system", text, quickReplies });
const safetyCheck = () => system(SAFETY_CHECK.question, SAFETY_CHECK.quickReplies);

export function isAwaitingSafetyAnswer(transcript: TranscriptMessage[]): boolean {
  const last = transcript.at(-1);
  return last?.role === "system" && last.text === SAFETY_CHECK.question;
}

export async function runTurn(input: {
  transcript: TranscriptMessage[];
  patient: { id: string; text: string };
  takenOver: boolean;
  callModel: CallModel;
}): Promise<TurnResult> {
  const { transcript, patient, takenOver, callModel } = input;

  // 1. A red flag already fired for this session: never call the AI again.
  if (takenOver) return { outcome: "taken_over", messages: [], ...empty };

  // 2. This message answers the direct check question.
  const prefix: OutMessage[] = [];
  if (isAwaitingSafetyAnswer(transcript)) {
    if (readSafetyAnswer(patient.text) === "positive") {
      return { outcome: "safety_positive", messages: [], ...empty };
    }
    prefix.push(system(SAFETY_CHECK.acknowledgeNo));
  } else {
    // 3. Phrase check on what the person wrote, before any AI call.
    const matched = checkPhrases(patient.text).matched;
    if (matched.length > 0) {
      return { outcome: "safety_check", messages: [safetyCheck()], ...empty, phraseMatches: matched };
    }
    // Asked whether this is a person or a therapist: a fixed, honest answer first.
    if (asksIfHuman(patient.text)) prefix.push(system(AI_DISCLOSURE));
    // Mentions calling for help: the app encourages it, with the approved numbers.
    if (mentionsGettingHelp(patient.text)) prefix.push(system(HELP_ENCOURAGEMENT));
  }

  // 4. Enough conversation: hand over to the questionnaire.
  const patientTurns = transcript.filter((m) => m.role === "patient").length + 1;
  if (patientTurns > MAX_PATIENT_TURNS) {
    return { outcome: "handoff", messages: [...prefix, system(HANDOFF_MESSAGE)], ...empty };
  }

  // 5. The model. Any failure (after its one retry) falls back to the questionnaire.
  // The model also sees the app's fixed messages for this turn, so it does not repeat them.
  const full: TranscriptMessage[] = [
    ...transcript,
    { id: patient.id, role: "patient", text: patient.text },
    ...prefix.map((m, i) => ({ id: `app-${i}`, role: "system" as const, text: m.text })),
  ];
  const patientIds = new Set(full.filter((m) => m.role === "patient").map((m) => m.id));
  let result: ModelResult;
  try {
    result = await callModel(buildMessages(full), patientIds);
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : String(e), attempts: 0 };
  }
  if (!result.ok) {
    return { outcome: "handoff", messages: [...prefix, system(FALLBACK_MESSAGE)], ...empty, modelFailed: true };
  }

  // 6. Guardrails.
  const guarded = guardTurn(result.output.reply, result.output.quickReplies);
  const extracted = result.output.extracted;

  // 7. The model's risk flag can only ADD a check question; so can a phrase in its extracted text.
  const extractedMatches = checkPhrases(extracted.map((f) => f.value).join(" \n ")).matched;
  if (result.output.possibleRiskLanguage || extractedMatches.length > 0) {
    return {
      outcome: "safety_check",
      messages: [...prefix, safetyCheck()],
      extracted,
      phraseMatches: extractedMatches,
      blocked: guarded.blocked,
      modelFailed: false,
    };
  }

  return {
    outcome: "reply",
    messages: [...prefix, { role: "assistant", text: guarded.reply, quickReplies: guarded.quickReplies }],
    extracted,
    phraseMatches: [],
    blocked: guarded.blocked,
    modelFailed: false,
  };
}
