import { z } from "zod";

/** Every instrument the item bank can hold. Scored items are locked: the AI never rewords them. */
export const Instrument = z.enum([
  "PHQ2",
  "PHQ9",
  "GAD2",
  "GAD7",
  "QC_SUICIDE", // the quick-check direct suicide question
  "ASQ",
  "CSSRS_SCREENER",
  "RED_FLAG", // the psychiatrist's red-flag questions
  "BPD_ADHD_EXTRA", // the four extra questions when BPD or ADHD history is known
  "FUNCTIONING",
]);
export type Instrument = z.infer<typeof Instrument>;

/** English is live; Arabic is stored but switched off until phase 2. */
const LocalisedText = z.object({
  en: z.string().min(1),
  ar: z.string(),
});

export const AnswerOption = z.object({
  value: z.number().int(),
  label: LocalisedText,
});

export const Item = z.object({
  id: z.string().regex(/^[A-Z0-9_]+-\d+$/, "id must look like PHQ9-9"),
  instrument: Instrument,
  number: z.number().int().positive(),
  text: LocalisedText,
  options: z.array(AnswerOption).min(2),
  /** false for published items that are asked but never added to the total (PHQ-9 item 10). */
  scored: z.boolean().optional(),
});
export type Item = z.infer<typeof Item>;

export const ItemBankFile = z
  .object({
    instrument: Instrument,
    version: z.string().min(1),
    /**
     * "approved" once the psychiatrist signs off. Until then: standard published wording
     * ("published_pending_approval") or, where no standard wording exists, our own "draft".
     */
    wordingStatus: z.enum(["approved", "published_pending_approval", "draft"]),
    source: z.string().min(1),
    arabicEnabled: z.boolean(),
    /** Shared lead-in shown above the items, e.g. "Over the last 2 weeks…" */
    stem: LocalisedText.optional(),
    items: z.array(Item).min(1),
  })
  .superRefine((file, ctx) => {
    file.items.forEach((item, i) => {
      if (item.instrument !== file.instrument) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i, "instrument"],
          message: `item ${item.id} belongs to ${item.instrument}, not ${file.instrument}`,
        });
      }
    });
    const numbers = file.items.map((item) => item.number);
    if (new Set(numbers).size !== numbers.length) {
      ctx.addIssue({ code: "custom", path: ["items"], message: "item numbers must be unique" });
    }
    if (file.arabicEnabled && file.items.some((item) => item.text.ar.trim() === "")) {
      ctx.addIssue({
        code: "custom",
        path: ["arabicEnabled"],
        message: "Arabic cannot be enabled while any item has no Arabic text",
      });
    }
  });
export type ItemBankFile = z.infer<typeof ItemBankFile>;
