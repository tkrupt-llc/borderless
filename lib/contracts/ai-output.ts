import { z } from "zod";

/** The only history fields the AI may extract. */
export const FieldName = z.enum([
  "presenting_complaint",
  "duration",
  "functioning",
  "sleep",
  "substances",
  "medical_conditions",
  "medicines",
  "preferences",
  "history_bpd_adhd", // self-reported only; never inferred
]);
export type FieldName = z.infer<typeof FieldName>;

export const ExtractedField = z.object({
  field: FieldName,
  value: z.string().min(1),
  sourceMessageId: z.string().min(1),
});
export type ExtractedField = z.infer<typeof ExtractedField>;

export const AiTurnOutput = z.object({
  reply: z.string().min(1),
  /** 0-3 short answers the person can tap instead of typing (research: buttons first). */
  quickReplies: z.array(z.string()).max(3),
  extracted: z.array(ExtractedField),
  /** Can only ADD a check question. It can never clear a red flag. */
  possibleRiskLanguage: z.boolean(),
});
export type AiTurnOutput = z.infer<typeof AiTurnOutput>;

/**
 * JSON Schema sent to the model API as the response format. Written by hand so
 * it stays within what strict structured-output modes accept (every property
 * required, no additional properties). Kept in sync with AiTurnOutput by test.
 */
export const aiTurnOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "quickReplies", "extracted", "possibleRiskLanguage"],
  properties: {
    reply: { type: "string" },
    quickReplies: { type: "array", items: { type: "string" } },
    extracted: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "value", "sourceMessageId"],
        properties: {
          field: { type: "string", enum: FieldName.options },
          value: { type: "string" },
          sourceMessageId: { type: "string" },
        },
      },
    },
    possibleRiskLanguage: { type: "boolean" },
  },
} as const;

export type ParseResult =
  | { ok: true; output: AiTurnOutput; dropped: { field: unknown; reason: string }[] }
  | { ok: false; error: string };

/**
 * Parses raw model text. The reply and risk flag must be valid or the whole
 * turn fails (the caller retries once, then falls back to the plain form).
 * Individual extracted fields are dropped, not fatal, when they are malformed
 * or cite a message that is not one of this session's patient messages: an
 * unquoted field never reaches the clinician summary.
 */
export function parseAiOutput(raw: string, patientMessageIds: ReadonlySet<string>): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "not valid JSON" };
  }

  const envelope = z
    .object({
      reply: z.string().min(1),
      // Quick replies are a nicety: missing or malformed ones never fail the turn.
      quickReplies: z.array(z.unknown()).optional(),
      extracted: z.array(z.unknown()),
      possibleRiskLanguage: z.boolean(),
    })
    .safeParse(json);
  if (!envelope.success) {
    return { ok: false, error: envelope.error.issues.map((i) => i.message).join("; ") };
  }

  const kept: ExtractedField[] = [];
  const dropped: { field: unknown; reason: string }[] = [];
  for (const candidate of envelope.data.extracted) {
    const field = ExtractedField.safeParse(candidate);
    if (!field.success) {
      dropped.push({ field: candidate, reason: "malformed" });
    } else if (!patientMessageIds.has(field.data.sourceMessageId)) {
      dropped.push({ field: candidate, reason: "source is not a patient message in this session" });
    } else {
      kept.push(field.data);
    }
  }

  return {
    ok: true,
    output: {
      reply: envelope.data.reply,
      quickReplies: (envelope.data.quickReplies ?? [])
        .filter((q): q is string => typeof q === "string" && q.trim().length > 0 && q.length <= 40)
        .slice(0, 3),
      extracted: kept,
      possibleRiskLanguage: envelope.data.possibleRiskLanguage,
    },
    dropped,
  };
}
