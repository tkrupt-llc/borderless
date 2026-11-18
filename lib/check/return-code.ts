/**
 * "Coming back?": a case reference (not secret) plus a short return code
 * (secret, shown once) restore a person's timeline after the browser cookie
 * has ended. Pure helpers, tested on their own; hashing happens on the server.
 */

// No 0/O, 1/I/L, so the code is easy to read out and type.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

/** A new code like "K7QM-3XRA" (8 characters, about 40 bits). */
export function newReturnCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Accepts the code however it's typed: any case, with or without spaces or a dash. */
export function normaliseCode(input: string): string | null {
  const clean = input.toUpperCase().replace(/[\s-]/g, "");
  if (clean.length !== 8 || [...clean].some((c) => !ALPHABET.includes(c))) return null;
  return clean;
}

/** "BL-AF09B5", "bl af09b5" or "AF09B5" -> "af09b5". */
export function parseReference(input: string): string | null {
  return /^(?:BL)?[\s-]*([0-9a-f]{6})$/i.exec(input.trim())?.[1]?.toLowerCase() ?? null;
}

/** Locked after too many wrong codes, for a while. */
export function isLocked(lockedUntil: string | null, now: Date): boolean {
  return lockedUntil !== null && new Date(lockedUntil).getTime() > now.getTime();
}

/** After a wrong code: the new failure count, and a lock once it reaches the limit. */
export function afterFailure(failed: number, now: Date): { failed: number; lockedUntil: string | null } {
  const next = failed + 1;
  return next >= MAX_FAILED_ATTEMPTS
    ? { failed: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() }
    : { failed: next, lockedUntil: null };
}
