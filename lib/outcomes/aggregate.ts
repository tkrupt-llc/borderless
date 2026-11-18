/**
 * Aggregate-only reporting. Pure, so the suppression rule is tested on its own.
 * Any count under MIN_GROUP is shown as "fewer than 10", and every number that
 * could be derived from it is withheld too, so no small group can be singled
 * out. Employer and university views use only these functions and never see a
 * session id, an answer or a score.
 */

export const MIN_GROUP = 10;
export type Cell = { suppressed: true } | { suppressed: false; n: number };
export type Share = { suppressed: true } | { suppressed: false; pct: number };

export const cell = (n: number, min = MIN_GROUP): Cell => (n < min ? { suppressed: true } : { suppressed: false, n });
export const cellText = (c: Cell) => (c.suppressed ? `fewer than ${MIN_GROUP}` : String(c.n));
export const shareText = (s: Share) => (s.suppressed ? "not shown (small group)" : `${s.pct}%`);

/** A share is shown only when the part, the rest and the whole are all big enough to publish. */
export function share(part: number, whole: number, min = MIN_GROUP): Share {
  if (whole < min || part < min || whole - part < min) return { suppressed: true };
  return { suppressed: false, pct: Math.round((part / whole) * 100) };
}

/**
 * A rate for the care team's own fairness table: shown when the group itself
 * has at least MIN_GROUP people. (The stricter share() is for anything an
 * outside organisation sees.)
 */
export function rate(part: number, whole: number, min = MIN_GROUP): Share {
  return whole < min ? { suppressed: true } : { suppressed: false, pct: Math.round((part / whole) * 100) };
}

/** Counts per group label, each cell suppressed under the minimum. Missing values group as "Not given". */
export function groupCounts<T>(rows: T[], key: (r: T) => string | null | undefined, min = MIN_GROUP): { group: string; count: Cell }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) || "Not given";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([group, n]) => ({ group, count: cell(n, min) }));
}

export type OrgSession = { orgId: string | null; path: string; createdAt: string; referred: boolean };

const PATH_LABELS: Record<string, string> = {
  quick: "Quick check",
  full: "Full check-in",
  followup: "Follow-up",
  crisis: "Help now",
  contact: "Talk to someone",
};

/**
 * What an employer or university sees about check-ins started from their page:
 * totals only, never anything about a person. If fewer than MIN_GROUP people
 * used it in the period, nothing beyond that fact is shown.
 */
export function orgReport(sessions: OrgSession[], orgId: string, min = MIN_GROUP) {
  const mine = sessions.filter((s) => s.orgId === orgId);
  const total = cell(mine.length, min);
  if (total.suppressed) return { total, byPath: [] as { group: string; count: Cell }[], referredShare: { suppressed: true } as Share };
  return {
    total,
    byPath: groupCounts(mine, (s) => PATH_LABELS[s.path] ?? "Other", min),
    referredShare: share(mine.filter((s) => s.referred).length, mine.length, min),
  };
}
export type OrgReport = ReturnType<typeof orgReport>;
