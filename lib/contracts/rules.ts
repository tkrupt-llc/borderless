import { z } from "zod";
import { Instrument } from "./item-bank";

/**
 * A rule file is a versioned YAML decision table owned by the psychiatrist.
 * Conditions are evaluated against "session facts", e.g. `item.PHQ9.9`,
 * `score.PHQ9.total`, `answer.QC_SUICIDE.1`, `flag.help_now`, `history.bpd`.
 */

const Fact = z.string().regex(/^[a-z]+(\.[A-Za-z0-9_]+)+$/, "fact must look like item.PHQ9.9");
const Operator = z.enum(["==", "!=", ">", ">=", "<", "<="]);

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { fact: string; op: z.infer<typeof Operator>; value: number | boolean | string };

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(Condition).min(1) }).strict(),
    z.object({ any: z.array(Condition).min(1) }).strict(),
    z
      .object({
        fact: Fact,
        op: Operator,
        value: z.union([z.number(), z.boolean(), z.string()]),
      })
      .strict(),
  ]),
);

export const RiskTier = z.enum(["imminent", "urgent", "elevated"]);
export type RiskTier = z.infer<typeof RiskTier>;

export const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("takeover_session") }).strict(),
  z.object({ action: z.literal("show_emergency_card") }).strict(),
  z.object({ action: z.literal("run_instrument"), instrument: Instrument }).strict(),
  z.object({ action: z.literal("create_task"), tier: RiskTier }).strict(),
  z.object({ action: z.literal("ask_check_question"), questionId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("propose_step"), step: z.number().int().min(0).max(4) }).strict(),
  z.object({ action: z.literal("cap_step"), maxStep: z.number().int().min(0).max(4) }).strict(),
  z.object({ action: z.literal("propose_urgent") }).strict(),
]);
export type Action = z.infer<typeof Action>;

export const Rule = z
  .object({
    id: z.string().regex(/^[A-Z]+(-[A-Z0-9]+)+$/, "id must look like RF-PHQ9-ITEM9"),
    description: z.string().min(1),
    when: Condition,
    then: z.array(Action).min(1),
  })
  .strict();
export type Rule = z.infer<typeof Rule>;

export const RuleFile = z
  .object({
    ruleset: z.enum(["red_flags", "routing", "bpd_adhd"]),
    version: z.string().min(1),
    owner: z.string().min(1),
    approvedBy: z.string().optional(),
    rules: z.array(Rule).min(1),
  })
  .strict()
  .superRefine((file, ctx) => {
    const ids = file.rules.map((r) => r.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["rules"], message: "rule ids must be unique" });
    }
  });
export type RuleFile = z.infer<typeof RuleFile>;
