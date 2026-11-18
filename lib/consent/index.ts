import consent from "@/content/consent.json";

/**
 * Granular, revocable consent. Pure, so the same rules run in the browser, on
 * the server and in tests. The consent log is append-only: the newest row per
 * purpose wins, and a revocation is simply a newer "false" row.
 */

export type Purpose = (typeof consent.purposes)[number];
export type PurposeId = Purpose["id"];
export type ConsentChoices = Partial<Record<string, boolean>>;
export type ConsentRow = { purpose: string; granted: boolean; created_at: string };

export const PURPOSES: Purpose[] = consent.purposes;
export const CONSENT_VERSION = consent.version;
export const purposeById = (id: string) => PURPOSES.find((p) => p.id === id);
export const isPurpose = (id: string): id is PurposeId => PURPOSES.some((p) => p.id === id);

/** Purposes asked at one place in the flow (and, for "start", only those for this path). */
export function purposesFor(askOn: string, path?: string): Purpose[] {
  return PURPOSES.filter((p) => p.askOn === askOn && (!("paths" in p) || !path || (p.paths as string[]).includes(path)));
}

/** Newest row per purpose wins; rows may arrive in any order. */
export function latestConsents(rows: ConsentRow[]): Record<string, boolean> {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return Object.fromEntries(sorted.map((r) => [r.purpose, r.granted]));
}

export const CHANNELS = ["phone", "sms", "whatsapp", "email"] as const;
export type Channel = (typeof CHANNELS)[number];
export const channelPurpose = (c: Channel) => `contact_${c}` as PurposeId;

/** Channels the care team may use right now. */
export function allowedChannels(consents: Record<string, boolean | undefined>): Channel[] {
  return CHANNELS.filter((c) => consents[channelPurpose(c)] === true);
}

/** What each choice switches on; used by the server to refuse anything not consented. */
export const may = {
  careTeamSees: (c: Record<string, boolean | undefined>) => c.clinician_review === true,
  useAi: (c: Record<string, boolean | undefined>) => c.ai_help === true,
  sharePhysicalHealth: (c: Record<string, boolean | undefined>) => c.physical_health === true,
  exportToGp: (c: Record<string, boolean | undefined>) => c.gp_sharing === true,
  countInStats: (c: Record<string, boolean | undefined>) => c.service_improvement === true,
  followUp: (c: Record<string, boolean | undefined>) => c.follow_up === true,
};

/**
 * A change made later on "See or delete your data". Care-team access is
 * required to use the service, so it can be withdrawn only by deleting your
 * data (which removes everything); every other purpose can be switched freely.
 */
export function canChangeLater(id: string): boolean {
  const p = purposeById(id);
  return Boolean(p) && !("required" in p! && p.required);
}
