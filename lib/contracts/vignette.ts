import { z } from "zod";
import { FieldName } from "./ai-output";

/**
 * A synthetic case written and gold-labelled by the psychiatrist. The
 * evaluation script plays it through the real intake and compares the result
 * with the gold labels.
 */

/** 0–4 are the stepped-care levels; "urgent" is the red-flag pathway. */
export const GoldStep = z.union([z.number().int().min(0).max(4), z.literal("urgent")]);

const answers = (length: number) => z.array(z.number().int().min(0).max(3)).length(length);

export const Vignette = z
  .object({
    id: z.string().regex(/^V\d{3}$/, "id must look like V001"),
    version: z.string().min(1),
    author: z.string().min(1),
    demographics: z.object({
      gender: z.enum(["female", "male"]),
      ageBand: z.enum(["18-24", "25-34", "35-44", "45-54", "55-65"]),
      nationality: z.string().min(1),
      /** e.g. "native English", "South Asian English", "English with Arabic words" */
      languageVariety: z.string().min(1),
    }),
    path: z.enum(["quick", "full"]),
    /** The first thing the simulated patient types. */
    opening: z.string().min(1),
    /** Scripted replies, used in order when the assistant asks follow-up questions. */
    followUps: z.array(z.string().min(1)).default([]),
    answers: z
      .object({
        PHQ9: answers(9),
        GAD7: answers(7),
        PHQ2: answers(2),
        GAD2: answers(2),
        QC_SUICIDE: z.boolean(),
        ASQ: z.array(z.boolean()).length(4),
        RED_FLAG: z.record(z.string(), z.boolean()),
        BPD_ADHD_EXTRA: z.array(z.boolean()).length(4),
      })
      .partial(),
    selfReportedHistory: z
      .object({ bpd: z.boolean(), adhd: z.boolean() })
      .default({ bpd: false, adhd: false }),
    gold: z.object({
      step: GoldStep,
      /** Rule IDs that must fire; empty when the case has no red flag. */
      redFlagRuleIds: z.array(z.string()),
      fields: z.partialRecord(FieldName, z.string().min(1)),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.path === "quick" && !v.answers.PHQ2) {
      ctx.addIssue({ code: "custom", path: ["answers", "PHQ2"], message: "quick-check vignettes need PHQ-2 answers" });
    }
    if (v.path === "full" && !v.answers.PHQ9) {
      ctx.addIssue({ code: "custom", path: ["answers", "PHQ9"], message: "full-assessment vignettes need PHQ-9 answers" });
    }
    if (v.gold.redFlagRuleIds.length > 0 && v.gold.step !== "urgent") {
      ctx.addIssue({ code: "custom", path: ["gold", "step"], message: "a red-flag case must have gold step 'urgent'" });
    }
  });
export type Vignette = z.infer<typeof Vignette>;
