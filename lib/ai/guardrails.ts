/**
 * Output guardrails: plain pattern checks on every AI reply and quick reply,
 * after the model call and before anything is shown or saved. Never AI.
 *
 * Blocks (approved decision #8, "content the AI must never produce"):
 *   diagnosis words, medication names or doses, therapy instructions,
 *   telling someone they are "fine" or "low risk", and anything discouraging
 *   emergency help. Also, per the UI research, the AI claiming its own feelings.
 * A blocked reply is replaced by a safe redirect to a person, never edited.
 * Tuned to over-block: a false block only costs one generic reply.
 * The term lists are DRAFT until the psychiatrist reviews them.
 */

export type GuardrailCategory =
  | "diagnosis"
  | "medication"
  | "therapy_instruction"
  | "false_reassurance"
  | "discourages_help"
  | "claims_feelings";

const RULES: { category: GuardrailCategory; pattern: RegExp }[] = [
  {
    category: "diagnosis",
    pattern:
      /\b(diagnos\w*|you (might|may|probably|could) have|you (may |might |probably )?suffer from|sounds? like you (have|'ve got)|depressi(on|ve disorder)|anxiety disorder|generali[sz]ed anxiety|panic disorder|bipolar|ptsd|post[- ]traumatic|ocd|obsessive[- ]compulsive|adhd|bpd|borderline|personality disorder|schizo\w*|psychosis|psychotic|manic|mania)\b/i,
  },
  {
    // Asking "are you taking any medicines?" is allowed (it is a history field);
    // naming drugs, doses or telling someone to start or stop is not.
    category: "medication",
    pattern:
      /\b(\d+\s?mg|milligrams?|doses?|dosage|antidepressants?|ssris?|snris?|benzodiazepines?|sertraline|fluoxetine|citalopram|escitalopram|paroxetine|venlafaxine|duloxetine|mirtazapine|bupropion|quetiapine|olanzapine|risperidone|aripiprazole|lithium|lamotrigine|valproate|diazepam|lorazepam|alprazolam|clonazepam|zolpidem|methylphenidate|ritalin|adderall|prozac|zoloft|lexapro|xanax|valium|stop taking|start taking)\b/i,
  },
  {
    category: "therapy_instruction",
    pattern:
      /\b(cbt|dbt|cognitive behaviou?ral|exposure therapy|reframe|reframing|deep breath\w*|try (some |a |doing )?(deep |box |paced |slow )?breath\w*|breathing (exercise|technique)s?|try (some |a )?(meditat|journal|mindful|grounding)\w*|you should (try|practi[cs]e|exercise|meditate)|homework)\b/i,
  },
  {
    category: "false_reassurance",
    pattern:
      // The lookbehinds let "I want to check you are safe" (the app's own check question) through.
      /\b(low risk|not at risk|(?<!check |check that |make sure |sure that )(you'?re|you are) (fine|ok|okay|safe|not in danger)|nothing to worry|no need to worry|don'?t (need|have) to (worry|see|seek|get help|talk)|you don'?t need (help|a doctor|a clinician|therapy|to see))\b/i,
  },
  {
    category: "discourages_help",
    pattern:
      /\b((don'?t|do not|doesn'?t) need to|no need to|don'?t|do not|shouldn'?t|should not|not necessary to|wouldn'?t|no point)\s+(call(ing)?|contact(ing)?|phon(e|ing)|go(ing)? to|ring(ing)?|see(ing)?)\s+(the |an? )?(999|998|911|112|emergency|police|ambulance|hospital|a&e|anyone|someone|doctor|helpline|sakina|clinician|person|services?)\b/i,
  },
  {
    category: "claims_feelings",
    pattern: /\bI (feel|am feeling|felt|'m feeling) (so )?(sad|worried|upset|hurt|happy|scared|heartbroken|terrible)\b/i,
  },
];

export const SAFE_REDIRECT =
  "That is something a clinician can talk through with you. I will make sure they see it. Is there anything else about how you have been feeling that you would like them to know?";

export function checkText(text: string): GuardrailCategory[] {
  return RULES.filter((r) => r.pattern.test(text)).map((r) => r.category);
}

// No emoji in clinical flows (UI research).
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

export type GuardedTurn = { reply: string; quickReplies: string[]; blocked: GuardrailCategory[] };

/** Applies the guardrails to one AI turn. */
export function guardTurn(reply: string, quickReplies: string[]): GuardedTurn {
  const cleanReply = reply.replace(EMOJI, "").trim();
  const blocked = checkText(cleanReply);
  // A blocked reply is replaced whole; its quick replies go with it.
  if (blocked.length > 0) return { reply: SAFE_REDIRECT, quickReplies: [], blocked };

  const safeQuickReplies = quickReplies
    .map((q) => q.replace(EMOJI, "").trim())
    .filter((q) => q.length > 0 && checkText(q).length === 0);
  return { reply: cleanReply, quickReplies: safeQuickReplies, blocked: [] };
}
