/**
 * A short reference for a session, shown to the patient on their confirmation
 * and to the care team in the queue, so a case can be matched without a name.
 * Derived from the session id; not a secret and not an access key.
 */
export function caseRef(sessionId: string): string {
  return `BL-${sessionId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
