/**
 * Discreet messages staff copy and send themselves (SMS, WhatsApp, email).
 * Pure and tested: they carry the case reference and a link, never a word
 * about health, so they are safe if someone else sees the phone.
 * All patient messages are sent manually by staff in the prototype;
 * automatic sending is a pilot step.
 */

export type Channel = "sms" | "whatsapp" | "email" | "phone" | "in_person";
export type MessageKind = "reply" | "followup" | "reminder_booking" | "reminder_attended" | "closing";

export const CHANNEL_LABELS: Record<Channel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
  phone: "Read out on a call",
  in_person: "In person",
};

/** Health words: never on anything someone else might see (banner, messages). */
export const HEALTH_WORDS = [
  "mental", "health", "wellbeing", "depress", "anxi", "suicid", "crisis", "therap", "counsel", "psychiatr",
  "psycholog", "mood", "worry", "stress", "diagnos", "self-harm",
];

/** Words a discreet message must never contain (tested): health words, plus anything naming the service. */
export const NOT_IN_DISCREET_MESSAGES = [...HEALTH_WORDS, "check-in", "check in", "clinician", "doctor", "borderless"];

const BODY: Record<MessageKind, (ref: string, link: string) => string> = {
  reply: (ref, link) => `You have a new message from your care team (reference ${ref}). To read it, open ${link} and enter your reference and code.`,
  followup: (ref, link) => `It's time for your next short questionnaire (reference ${ref}). It takes a few minutes: ${link}`,
  reminder_booking: (ref, link) => `A reminder about your appointment (reference ${ref}). If you haven't booked yet, or would like help booking, open ${link} and enter your reference and code.`,
  reminder_attended: (ref, link) => `A quick question about your recent appointment (reference ${ref}). Please let us know how it went: open ${link} and enter your reference and code.`,
  closing: (ref, link) => `We tried to reach you a few times (reference ${ref}) and we're closing this request for now. You can come back any time: open ${link} and enter your reference and code.`,
};

const SUBJECT: Record<MessageKind, string> = {
  reply: "A new message for you",
  followup: "Your next short questionnaire",
  reminder_booking: "A reminder about your appointment",
  reminder_attended: "About your recent appointment",
  closing: "We tried to reach you",
};

/** The message to copy, written for the channel the patient chose. */
export function discreetMessage(kind: MessageKind, channel: Channel, ref: string, link: string): string {
  const body = BODY[kind](ref, link);
  if (channel === "email") return `Subject: ${SUBJECT[kind]}\n\nHello,\n\n${body}\n\nYour care team`;
  if (channel === "phone") return `Say: "Hello, this is your care team returning your message. ${body.replace(/open .*$/, "we'll also send you a link.")}"`;
  if (channel === "in_person") return body;
  return `Hello, this is your care team. ${body}`;
}

/** Any banned word found (empty when the message is discreet). */
export function healthWordsIn(text: string): string[] {
  const t = text.toLowerCase();
  return NOT_IN_DISCREET_MESSAGES.filter((w) => t.includes(w));
}

// --- Safe times -----------------------------------------------------------------

/** Windows for each "safe time" choice, in UAE time. The UAE weekend is Saturday and Sunday. */
const WINDOWS: Record<string, { days: number[]; from: number; to: number }> = {
  weekday_mornings: { days: [1, 2, 3, 4, 5], from: 8, to: 12 },
  weekday_evenings: { days: [1, 2, 3, 4, 5], from: 17, to: 21 },
  weekends: { days: [0, 6], from: 9, to: 21 },
};

function uaeDayHour(at: Date): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(at);
  const wd = parts.find((p) => p.type === "weekday")!.value;
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  return { day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd), hour };
}

/** True when the person chose safe times and `at` falls outside all of them. No choice means no warning. */
export function outsideSafeTimes(times: string[] | null | undefined, at: Date): boolean {
  if (!times || times.length === 0 || times.includes("any_time")) return false;
  const { day, hour } = uaeDayHour(at);
  return !times.some((t) => {
    const w = WINDOWS[t];
    return w && w.days.includes(day) && hour >= w.from && hour < w.to;
  });
}

/** "Send new return code": the only message that carries a code. The old code stops working. */
export function newCodeMessage(channel: Channel, ref: string, link: string, code: string): string {
  const body = `Here is a new code to see your messages (reference ${ref}): ${code}. Open ${link} and enter your reference and this code. Your old code no longer works.`;
  if (channel === "email") return `Subject: Your new code\n\nHello,\n\n${body}\n\nYour care team`;
  return `Hello, this is your care team. ${body}`;
}
