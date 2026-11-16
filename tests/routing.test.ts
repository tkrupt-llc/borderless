import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRuleFile } from "@/lib/rules/parse";
import { proposeStep } from "@/lib/rules/routing";
import { buildSummary } from "@/lib/summary/build";

const routing = parseRuleFile(readFileSync("content/rules/routing.yaml", "utf8"));
const full = (phq9: number, gad7: number, extra = {}) =>
  proposeStep(routing, { "score.PHQ9.total": phq9, "score.GAD7.total": gad7, "path.quick": false, ...extra });

describe("stepped-care routing (full check-in)", () => {
  it.each([
    [4, 4, 0],
    [5, 0, 1],
    [0, 9, 1],
    [10, 0, 3],
    [9, 14, 3],
    [15, 0, 4],
    [3, 21, 4],
  ])("PHQ-9 %i, GAD-7 %i -> step %i", (phq9, gad7, step) => {
    expect(full(phq9, gad7).step).toBe(step);
  });

  it("a physical condition with mild scores proposes primary care (step 2)", () => {
    expect(full(6, 2, { "field.medical_conditions": true }).step).toBe(2);
    expect(full(2, 2, { "field.medical_conditions": true }).step).toBe(0);
  });

  it("functional impact raises mild scores to step 3", () => {
    const p = full(6, 2, { "item.PHQ9.10": 2 });
    expect(p.step).toBe(3);
    expect(p.ruleIds).toContain("RT-FUNCTIONAL-IMPACT");
  });

  it("records the rule ids and reasons", () => {
    const p = full(12, 3);
    expect(p.ruleIds).toEqual(["RT-FULL-MILD", "RT-FULL-MODERATE"]);
    expect(p.reasons).toHaveLength(2);
    expect(p.rulesetVersion).toBe(routing.version);
  });
});

describe("stepped-care routing (quick check)", () => {
  const quick = (phq2: boolean, gad2: boolean) =>
    proposeStep(routing, { "score.PHQ2.positive": phq2, "score.GAD2.positive": gad2, "path.quick": true });

  it("both gates negative -> step 0", () => expect(quick(false, false).step).toBe(0));
  it("a positive gate -> step 1", () => expect(quick(true, false).step).toBe(1));
  it("never proposes more than step 1, even with high full-scale scores present", () => {
    const p = proposeStep(routing, { "score.PHQ9.total": 20, "score.PHQ2.positive": true, "score.GAD2.positive": true, "path.quick": true });
    expect(p.step).toBe(1);
  });
  it("proposes nothing when nothing was scored", () => {
    expect(proposeStep(routing, { "path.quick": false }).step).toBeNull();
  });
});

describe("clinician summary", () => {
  const base = {
    fields: [
      { field: "sleep", value: "wakes at 3am", quote: "I wake at 3am most nights" },
      { field: "presenting_complaint", value: "low since moving", quote: "I've felt low since I moved here" },
      { field: "duration", value: "3 weeks", quote: null }, // no quote: must be left out
      { field: "medical_conditions", value: "diabetes", quote: "I have diabetes and skip my tablets" },
    ],
    scores: [{ instrument: "PHQ9", total: 12, band: "moderate" }],
    redFlags: [],
    preferences: { language: null, clinicianGender: null },
    history: { bpd: false, adhd: false },
    proposal: { step: 3, urgent: false, reasons: ["PHQ-9 or GAD-7 in the moderate range (10 or more)"] },
  };

  it("uses the approved order and drops lines without a patient quote", () => {
    const lines = buildSummary(base);
    expect(lines.map((l) => l.key)).toEqual(["presenting_complaint", "scores", "sleep", "medical_conditions", "physical_prompt", "proposal"]);
    expect(lines.find((l) => l.key === "sleep")?.quote).toBe("I wake at 3am most nights");
  });

  it("names the proposed step, or the urgent pathway after a red flag", () => {
    expect(buildSummary(base).at(-1)?.text).toContain("Step 3: Psychologist or tele-mental health");
    const urgent = buildSummary({
      ...base,
      redFlags: [{ ruleId: "RF-PHQ9-ITEM9", tier: "urgent", trigger: "questionnaire answer" }],
      proposal: { step: null, urgent: true, reasons: ["PHQ-9 item 9 above zero"] },
    });
    expect(urgent.find((l) => l.key === "red_flags")?.text).toBe("RF-PHQ9-ITEM9 (urgent)");
    expect(urgent.at(-1)?.text).toContain("Urgent pathway");
  });
});
