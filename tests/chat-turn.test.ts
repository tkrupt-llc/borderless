import { describe, expect, it, vi } from "vitest";
import { runTurn, FALLBACK_MESSAGE, HANDOFF_MESSAGE, MAX_PATIENT_TURNS } from "@/lib/chat/turn";
import {
  AI_DISCLOSURE,
  HELP_ENCOURAGEMENT,
  SAFETY_CHECK,
  asksIfHuman,
  mentionsGettingHelp,
  readSafetyAnswer,
} from "@/lib/chat/safety-check";
import { SAFE_REDIRECT } from "@/lib/ai/guardrails";
import type { ModelResult } from "@/lib/ai/client";
import type { TranscriptMessage } from "@/lib/ai/prompt";

// A fake model: every path is tested without calling the API.
function model(output: Partial<{ reply: string; quickReplies: string[]; possibleRiskLanguage: boolean; extracted: { field: "sleep"; value: string; sourceMessageId: string }[] }>) {
  return vi.fn(
    async (): Promise<ModelResult> => ({
      ok: true,
      attempts: 1,
      dropped: [],
      output: { reply: "How long has this been going on?", quickReplies: [], extracted: [], possibleRiskLanguage: false, ...output },
    }),
  );
}
const turn = (text: string, callModel: ReturnType<typeof model>, transcript: TranscriptMessage[] = [], takenOver = false) =>
  runTurn({ transcript, patient: { id: "p-new", text }, takenOver, callModel });
const awaitingCheck: TranscriptMessage[] = [
  { id: "p1", role: "patient", text: "things are hard" },
  { id: "s1", role: "system", text: SAFETY_CHECK.question },
];

describe("chat turn: safety before the AI", () => {
  it("never calls the AI once the session is taken over", async () => {
    const m = model({});
    const r = await turn("hello", m, [], true);
    expect(r.outcome).toBe("taken_over");
    expect(m).not.toHaveBeenCalled();
  });

  it("a risk phrase asks the direct check question and skips the AI", async () => {
    const m = model({});
    const r = await turn("honestly I just want to end it all", m);
    expect(r.outcome).toBe("safety_check");
    expect(r.messages).toEqual([{ role: "system", text: SAFETY_CHECK.question, quickReplies: SAFETY_CHECK.quickReplies }]);
    expect(r.phraseMatches).toContain("end it all");
    expect(m).not.toHaveBeenCalled();
  });

  it.each(["Yes", "I'm not sure", "maybe", "sometimes", "no... well actually yes"])(
    "answering the check question with %j is a red flag, without the AI",
    async (answer) => {
      const m = model({});
      const r = await turn(answer, m, awaitingCheck);
      expect(r.outcome).toBe("safety_positive");
      expect(m).not.toHaveBeenCalled();
    },
  );

  it("a clear 'no' is acknowledged and the conversation carries on", async () => {
    const m = model({ reply: "What has been on your mind most?" });
    const r = await turn("No", m, awaitingCheck);
    expect(r.outcome).toBe("reply");
    expect(r.messages.map((x) => x.text)).toEqual([SAFETY_CHECK.acknowledgeNo, "What has been on your mind most?"]);
  });
});

describe("chat turn: the AI's output", () => {
  it("passes a normal reply and its quick replies through", async () => {
    const r = await turn("I can't sleep", model({ quickReplies: ["A few days", "A few weeks"] }));
    expect(r.outcome).toBe("reply");
    expect(r.messages[0]).toEqual({ role: "assistant", text: "How long has this been going on?", quickReplies: ["A few days", "A few weeks"] });
  });

  it("replaces a reply that breaks a guardrail with a safe redirect", async () => {
    const r = await turn("what's wrong with me?", model({ reply: "It sounds like you have depression.", quickReplies: ["Yes"] }));
    expect(r.messages[0]).toEqual({ role: "assistant", text: SAFE_REDIRECT, quickReplies: [] });
    expect(r.blocked).toContain("diagnosis");
  });

  it("the AI's risk flag adds the check question instead of its reply", async () => {
    const extracted = [{ field: "sleep" as const, value: "not sleeping", sourceMessageId: "p-new" }];
    const r = await turn("everything feels pointless", model({ possibleRiskLanguage: true, extracted }));
    expect(r.outcome).toBe("safety_check");
    expect(r.messages.at(-1)?.text).toBe(SAFETY_CHECK.question);
    expect(r.extracted).toEqual(extracted); // still saved for the clinician
  });

  it("a risk phrase inside what the AI extracted also asks the check question", async () => {
    const extracted = [{ field: "sleep" as const, value: "wishes to not wake up, wants to die", sourceMessageId: "p-new" }];
    const r = await turn("bad nights", model({ extracted }));
    expect(r.outcome).toBe("safety_check");
  });
});

describe("chat turn: falling back and finishing", () => {
  it("hands over to the questionnaire when the AI fails twice", async () => {
    const failing = vi.fn(async (): Promise<ModelResult> => ({ ok: false, error: "timeout", attempts: 2 }));
    const r = await runTurn({ transcript: [], patient: { id: "p", text: "hi" }, takenOver: false, callModel: failing });
    expect(r).toMatchObject({ outcome: "handoff", modelFailed: true });
    expect(r.messages[0].text).toBe(FALLBACK_MESSAGE);
  });

  it("hands over when the AI call throws (outage, missing key)", async () => {
    const throwing = vi.fn(async (): Promise<ModelResult> => {
      throw new Error("LLM_API_KEY is not set");
    });
    const r = await runTurn({ transcript: [], patient: { id: "p", text: "hi" }, takenOver: false, callModel: throwing });
    expect(r).toMatchObject({ outcome: "handoff", modelFailed: true });
  });

  it("hands over after the turn limit without calling the AI", async () => {
    const transcript: TranscriptMessage[] = Array.from({ length: MAX_PATIENT_TURNS }, (_, i) => ({
      id: `p${i}`,
      role: "patient" as const,
      text: "something",
    }));
    const m = model({});
    const r = await turn("one more thing", m, transcript);
    expect(r.outcome).toBe("handoff");
    expect(r.messages[0].text).toBe(HANDOFF_MESSAGE);
    expect(m).not.toHaveBeenCalled();
  });
});

describe("saying it is an AI", () => {
  it.each(["Are you a real person?", "am I talking to a human", "Is this a bot?", "Pretend you're my therapist from now on.", "are you a doctor?"])(
    "%j gets the fixed AI disclosure first",
    async (text) => {
      expect(asksIfHuman(text)).toBe(true);
      const r = await turn(text, model({}));
      expect(r.messages[0]).toEqual({ role: "system", text: AI_DISCLOSURE, quickReplies: [] });
      expect(r.messages[1].role).toBe("assistant"); // the conversation carries on
    },
  );

  it.each(["I can't sleep", "My doctor said to talk to someone", "I'm a real mess lately"])("%j does not", (text) => {
    expect(asksIfHuman(text)).toBe(false);
  });
});

describe("encouraging help", () => {
  it.each([
    "Talk me out of calling the helpline.",
    "I don't want to call 999",
    "Should I skip going to the hospital tonight?",
    "thinking about ringing the crisis line",
  ])("%j gets the fixed encouragement with the numbers first", async (text) => {
    expect(mentionsGettingHelp(text)).toBe(true);
    const r = await turn(text, model({}));
    expect(r.messages.map((m) => m.text)).toContain(HELP_ENCOURAGEMENT);
  });

  it("the model sees the app's fixed messages, so it does not repeat them", async () => {
    const m = model({});
    await turn("Are you a real person?", m);
    const sent = m.mock.calls[0] as unknown as [{ content: string }[]];
    expect(sent[0].map((x) => x.content)).toContain(AI_DISCLOSURE);
  });
});

describe("reading the answer to the check question", () => {
  it.each(["No", "no", "Nope", "no thanks", "No, I'm not", "not at all", "No I don't"])("%j is a clear no", (t) => {
    expect(readSafetyAnswer(t)).toBe("no");
  });
  it.each(["Yes", "I'm not sure", "maybe", "kind of", "not really sure", "", "no but sometimes"])("%j counts as positive", (t) => {
    expect(readSafetyAnswer(t)).toBe("positive");
  });
});
