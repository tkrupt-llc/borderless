import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import consent from "@/content/consent.json";
import wording from "@/content/result-wording.json";
import { SCORED_INSTRUMENTS } from "@/lib/rules/scoring";

const migration = readFileSync("supabase/migrations/20261111000000_init.sql", "utf8");

describe("consent content", () => {
  const enumValues = /create type consent_purpose as enum \(([^)]*)\)/
    .exec(migration)![1]
    .match(/'([^']+)'/g)!
    .map((v) => v.slice(1, -1));

  it("only uses purposes the database accepts", () => {
    for (const p of consent.purposes) expect(enumValues).toContain(p.id);
  });

  it("asks only clinician review before the questions; the rest on the result page", () => {
    expect(consent.purposes.filter((p) => p.askOn === "start").map((p) => p.id)).toEqual(["clinician_review"]);
    for (const p of consent.purposes) expect(["start", "result"]).toContain(p.askOn);
  });

  it("pre-ticks nothing", () => {
    for (const p of consent.purposes) expect(p.default).toBe(false);
  });
});

describe("result wording", () => {
  // Every band the scoring code can produce must have plain words, or the card would hide a result.
  const BANDS: Record<string, string[]> = {
    PHQ2: ["positive", "negative"],
    GAD2: ["positive", "negative"],
    PHQ9: ["minimal", "mild", "moderate", "moderately_severe", "severe"],
    GAD7: ["minimal", "mild", "moderate", "severe"],
  };

  it.each(Object.entries(BANDS))("%s has wording for every band", (instrument, bands) => {
    const w = (wording.instruments as Record<string, { bands: Record<string, string> }>)[instrument];
    for (const band of bands) expect(w.bands[band], `${instrument} ${band}`).toBeTruthy();
  });

  it("covers every scored instrument shown on a result card", () => {
    const shownOnCard = SCORED_INSTRUMENTS.filter((i) => i !== "ASQ"); // ASQ is crisis-only, never a result card
    expect(Object.keys(wording.instruments).sort()).toEqual([...shownOnCard].sort());
  });

  it("never uses a diagnosis label", () => {
    const text = JSON.stringify(wording.instruments).toLowerCase();
    for (const label of ["depression", "depressed", "anxiety disorder", "disorder", "diagnos"]) {
      expect(text).not.toContain(label);
    }
  });
});
