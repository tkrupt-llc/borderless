import { describe, expect, it } from "vitest";
import { allowedChannels, canChangeLater, latestConsents, may, purposesFor, PURPOSES } from "@/lib/consent";
import { buildGpBundle, ConsentRequired } from "@/lib/fhir/bundle";
import { computeOutcomes, type OutcomeSession } from "@/lib/outcomes/metrics";

const row = (purpose: string, granted: boolean, minute: number) => ({
  purpose,
  granted,
  created_at: `2026-11-18T09:${String(minute).padStart(2, "0")}:00Z`,
});

describe("granular consent", () => {
  it("has separate choices for care team, AI help, each contact channel, GP sharing and statistics", () => {
    const ids = PURPOSES.map((p) => p.id);
    for (const id of ["clinician_review", "ai_help", "contact_phone", "contact_sms", "contact_whatsapp", "contact_email", "gp_sharing", "service_improvement", "physical_health"]) {
      expect(ids).toContain(id);
    }
  });

  it("asks AI help only on the full check-in", () => {
    expect(purposesFor("start", "quick").map((p) => p.id)).toEqual(["clinician_review"]);
    expect(purposesFor("start", "full").map((p) => p.id)).toEqual(["clinician_review", "ai_help"]);
  });

  it("care-team access is required; every other choice can be changed later", () => {
    expect(canChangeLater("clinician_review")).toBe(false);
    for (const p of PURPOSES.filter((p) => p.id !== "clinician_review")) expect(canChangeLater(p.id)).toBe(true);
    expect(canChangeLater("not_a_purpose")).toBe(false);
  });
});

describe("consent revocation", () => {
  it("the newest row wins, whatever order the rows arrive in", () => {
    const rows = [row("gp_sharing", false, 5), row("gp_sharing", true, 1)];
    expect(latestConsents(rows).gp_sharing).toBe(false);
    expect(latestConsents([...rows, row("gp_sharing", true, 9)]).gp_sharing).toBe(true);
  });

  it("revoking GP sharing blocks the FHIR summary", () => {
    const base = { ref: "BL-ABC123", createdAt: "2026-11-18T09:00:00Z", scores: [{ instrument: "PHQ9", total: 12, band: "moderate" }], physicalConditions: null, physicalOther: null, proposedStep: null };
    const granted = latestConsents([row("gp_sharing", true, 1)]);
    expect(buildGpBundle({ ...base, consents: granted }).resourceType).toBe("Bundle");
    const revoked = latestConsents([row("gp_sharing", true, 1), row("gp_sharing", false, 2)]);
    expect(() => buildGpBundle({ ...base, consents: revoked })).toThrow(ConsentRequired);
  });

  it("revoking physical health keeps conditions out of the GP summary", () => {
    const input = {
      ref: "BL-ABC123",
      createdAt: "2026-11-18T09:00:00Z",
      scores: [],
      physicalConditions: ["diabetes"],
      physicalOther: "asthma",
      proposedStep: null,
    };
    const both = latestConsents([row("gp_sharing", true, 1), row("physical_health", true, 1)]);
    const conditions = (c: Record<string, boolean>) => buildGpBundle({ ...input, consents: c }).entry.filter((e) => e.resource.resourceType === "Condition");
    expect(conditions(both)).toHaveLength(2);
    expect(conditions({ ...both, physical_health: false })).toHaveLength(0);
  });

  it("revoking a contact channel removes it from the channels the care team may use", () => {
    const c = latestConsents([row("contact_phone", true, 1), row("contact_sms", true, 1), row("contact_phone", false, 3)]);
    expect(allowedChannels(c)).toEqual(["sms"]);
  });

  it("revoking AI help switches the assistant off", () => {
    expect(may.useAi(latestConsents([row("ai_help", true, 1)]))).toBe(true);
    expect(may.useAi(latestConsents([row("ai_help", true, 1), row("ai_help", false, 2)]))).toBe(false);
  });

  it("revoking anonymous statistics removes the person from the service overview", () => {
    const s = (id: string, statsConsent: boolean): OutcomeSession => ({
      id, path: "quick", parentId: null, createdAt: "2026-11-01T09:00:00Z", statsConsent,
      age: null, gender: null, nationality: null, language: null, emirate: null,
    });
    const out = computeOutcomes({ sessions: [s("a", true), s("b", false)], receipt: [], scores: [], crisisTasks: [], adverse: [] });
    expect(out.counted).toBe(1);
    expect(out.excludedNoConsent).toBe(1);
  });
});

describe("GP summary (FHIR R4)", () => {
  it("is a collection bundle with scores as observations, marked not a diagnosis", () => {
    const b = buildGpBundle({
      ref: "BL-ABC123",
      createdAt: "2026-11-18T09:00:00Z",
      consents: { gp_sharing: true },
      scores: [{ instrument: "PHQ9", total: 12, band: "moderate" }, { instrument: "GAD7", total: 6, band: "mild" }],
      physicalConditions: null,
      physicalOther: null,
      proposedStep: "Primary care",
    });
    expect(b.type).toBe("collection");
    const obs = b.entry.filter((e) => e.resource.resourceType === "Observation");
    expect(obs).toHaveLength(2);
    expect(JSON.stringify(obs)).toContain("44261-6");
    expect(JSON.stringify(obs)).toContain("Screening score, not a diagnosis.");
    expect(b.entry.some((e) => e.resource.resourceType === "ServiceRequest")).toBe(true);
  });
});
