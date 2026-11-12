import { z } from "zod";

/** The psychiatrist's red-flag phrase list. A match asks a direct check question; it never labels silently. */
export const PhraseList = z
  .object({
    version: z.string().min(1),
    owner: z.string().min(1),
    status: z.enum(["approved", "draft"]),
    source: z.string().min(1),
    phrases: z.array(z.string().min(2)).min(1),
  })
  .strict();
export type PhraseList = z.infer<typeof PhraseList>;
