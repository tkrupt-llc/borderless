import OpenAI from "openai";
import { aiTurnOutputJsonSchema, parseAiOutput, type AiTurnOutput } from "@/lib/contracts/ai-output";

/**
 * The single adapter between the app and the model API.
 *
 * Groq exposes an OpenAI-compatible API, so this uses the openai SDK with a
 * different base URL. Moving the pilot to Azure OpenAI in a UAE region should
 * only need LLM_BASE_URL, LLM_API_KEY and LLM_MODEL changed.
 *
 * Nothing here decides risk, scoring or routing. Those are fixed rules that
 * run before and after this call.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ModelResult =
  | { ok: true; output: AiTurnOutput; dropped: { field: unknown; reason: string }[]; attempts: number }
  | { ok: false; error: string; attempts: number };

const MAX_ATTEMPTS = 2; // one retry on invalid output, then the caller falls back to the plain form

let client: OpenAI | undefined;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) throw new Error("LLM_API_KEY is not set");
    client = new OpenAI({
      apiKey,
      baseURL: process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1",
      timeout: 15_000,
      maxRetries: 0, // retries are counted here, not hidden inside the SDK
    });
  }
  return client;
}

function responseFormat() {
  // Strict JSON-schema output is only supported on some models. Without it the
  // model is asked for a JSON object, and zod validation below is the guarantee.
  if (process.env.LLM_STRICT_SCHEMA === "true") {
    return {
      type: "json_schema" as const,
      json_schema: { name: "intake_turn", strict: true, schema: aiTurnOutputJsonSchema as Record<string, unknown> },
    };
  }
  return { type: "json_object" as const };
}

export async function callIntakeModel(
  messages: ChatMessage[],
  patientMessageIds: ReadonlySet<string>,
): Promise<ModelResult> {
  const model = process.env.LLM_MODEL;
  if (!model) throw new Error("LLM_MODEL is not set");

  let lastError = "unknown error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const completion = await getClient().chat.completions.create({
        model,
        messages,
        temperature: 0.2,
        response_format: responseFormat(),
      });
      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        lastError = `empty response (finish_reason: ${completion.choices[0]?.finish_reason ?? "none"})`;
        continue;
      }
      const parsed = parseAiOutput(raw, patientMessageIds);
      if (parsed.ok) return { ...parsed, attempts: attempt };
      lastError = `invalid output: ${parsed.error}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { ok: false, error: lastError, attempts: MAX_ATTEMPTS };
}
