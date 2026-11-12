/**
 * The direct check question. Asked (never by the AI) when a risk phrase
 * appears or the AI flags possible risk language. The spec: a phrase match
 * "prompts a direct check question, never a silent label".
 * Wording is DRAFT until the psychiatrist approves it.
 */
export const SAFETY_CHECK = {
  question:
    "Thank you for telling me. I want to check you are safe. Are you having thoughts of ending your life or hurting yourself?",
  quickReplies: ["Yes", "No", "I'm not sure"],
  // After a clear "no" the chat carries on.
  acknowledgeNo: "Thank you for letting me know. If that changes, tap “I need help now” at any time.",
};

/**
 * Transparency never depends on the model: if someone asks whether they are
 * talking to a person (or asks the assistant to be their therapist), this
 * fixed answer comes first (UI research: always label the AI).
 */
export const AI_DISCLOSURE = "I'm an AI assistant, not a person or a therapist. A clinician will read everything you write.";

const ASKS_IF_HUMAN =
  /\b(are you (a |an )?(real|human|person|people|bot|robot|ai|machine|computer|therapist|doctor|counsell?or)|am i (talking|speaking|chatting) (to|with) (a |an )?(real|human|person|bot|robot|ai|machine|computer)|is this (a |an )?(real person|human|bot|robot|ai)|(pretend|act|be) (like |as )?(you'?re |you are |to be )?(my |a )?(therapist|counsell?or|doctor|human|real person|friend))/i;

export function asksIfHuman(text: string): boolean {
  return ASKS_IF_HUMAN.test(text.replace(/[’]/g, "'"));
}

/**
 * Whenever someone mentions calling for help, the app (never the model)
 * encourages it, with the approved numbers. Nothing generated can talk anyone
 * out of seeking help (tech spec: "the bypass").
 */
export const HELP_ENCOURAGEMENT =
  "If you need help now, please call 998 (ambulance), 999 (police) or 800-SAKINA (800 725462), any time. The “I need help now” button is always at the bottom of the screen.";

const MENTIONS_GETTING_HELP =
  /\b(call(ing)?|ring(ing)?|phon(e|ing)|contact(ing)?|go(ing)? to|skip(ping)?)\s+(the |a |an )?(helpline|hotline|crisis line|999|998|911|112|ambulance|police|hospital|a&e|emergency|er|sakina)\b/i;

export function mentionsGettingHelp(text: string): boolean {
  return MENTIONS_GETTING_HELP.test(text);
}

/**
 * Over-detects on purpose: only a clear "no" counts as no. "Yes", "not sure",
 * "maybe", an unclear answer or anything else is treated as positive, which
 * shows the emergency numbers and alerts the care team.
 */
export function readSafetyAnswer(text: string): "no" | "positive" {
  const t = text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const clearNo = /^(no|nope|nah|no im not|no i am not|no i dont|no i do not|not at all|no not at all|im not|i am not)( thanks?| thank you)?$/;
  return clearNo.test(t) ? "no" : "positive";
}
