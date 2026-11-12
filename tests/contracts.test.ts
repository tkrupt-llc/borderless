import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { ItemBankFile } from "@/lib/contracts/item-bank";
import { RuleFile } from "@/lib/contracts/rules";
import { AiTurnOutput, aiTurnOutputJsonSchema, FieldName, parseAiOutput } from "@/lib/contracts/ai-output";
import { Vignette } from "@/lib/contracts/vignette";

const root = join(__dirname, "..");
const readJson = (path: string) => JSON.parse(readFileSync(join(root, path), "utf8"));
const readYaml = (path: string) => parseYaml(readFileSync(join(root, path), "utf8"));

describe("item bank contract", () => {
  it("accepts the PHQ-2 content file", () => {
    const result = ItemBankFile.safeParse(readJson("content/item-bank/phq2.json"));
    expect(result.error?.issues).toBeUndefined();
  });

  it("refuses to switch Arabic on while Arabic text is missing", () => {
    const file = { ...readJson("content/item-bank/phq2.json"), arabicEnabled: true };
    expect(ItemBankFile.safeParse(file).success).toBe(false);
  });

  it("rejects an item filed under the wrong instrument", () => {
    const file = readJson("content/item-bank/phq2.json");
    file.items[0].instrument = "GAD2";
    expect(ItemBankFile.safeParse(file).success).toBe(false);
  });
});

describe("rule file contract", () => {
  it("accepts the red-flag rule file", () => {
    const result = RuleFile.safeParse(readYaml("content/rules/red-flags.yaml"));
    expect(result.error?.issues).toBeUndefined();
  });

  it("rejects duplicate rule ids", () => {
    const file = readYaml("content/rules/red-flags.yaml");
    file.rules.push(file.rules[0]);
    expect(RuleFile.safeParse(file).success).toBe(false);
  });

  it("rejects an unknown action", () => {
    const file = readYaml("content/rules/red-flags.yaml");
    file.rules[0].then.push({ action: "lower_risk" });
    expect(RuleFile.safeParse(file).success).toBe(false);
  });
});

describe("AI output contract", () => {
  const patientIds = new Set(["m1", "m3"]);
  const example = {
    reply: "Thank you for telling me. How long has your sleep been like this?",
    quickReplies: ["A few days", "A few weeks", "Months or longer"],
    extracted: [
      { field: "sleep", value: "wakes at 3am most nights", sourceMessageId: "m1" },
      { field: "presenting_complaint", value: "tight chest, can't switch off", sourceMessageId: "m3" },
    ],
    possibleRiskLanguage: false,
  };

  it("accepts a valid example", () => {
    expect(AiTurnOutput.safeParse(example).success).toBe(true);
    const parsed = parseAiOutput(JSON.stringify(example), patientIds);
    expect(parsed.ok && parsed.output.extracted).toHaveLength(2);
  });

  it("drops a field that cites no message or a non-patient message", () => {
    const raw = JSON.stringify({
      ...example,
      extracted: [
        ...example.extracted,
        { field: "medicines", value: "sertraline", sourceMessageId: "m2" }, // m2 is an assistant message
        { field: "duration", value: "3 weeks" }, // no source at all
      ],
    });
    const parsed = parseAiOutput(raw, patientIds);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.output.extracted.map((f) => f.field)).toEqual(["sleep", "presenting_complaint"]);
    expect(parsed.dropped).toHaveLength(2);
  });

  it("keeps at most 3 short quick replies and never fails the turn over them", () => {
    const raw = JSON.stringify({ ...example, quickReplies: ["Yes", "", 42, "x".repeat(41), "No", "Maybe", "Later"] });
    const parsed = parseAiOutput(raw, patientIds);
    expect(parsed.ok && parsed.output.quickReplies).toEqual(["Yes", "No", "Maybe"]);
    const { quickReplies: _omit, ...withoutQuickReplies } = example;
    void _omit;
    const missing = parseAiOutput(JSON.stringify(withoutQuickReplies), patientIds);
    expect(missing.ok && missing.output.quickReplies).toEqual([]);
  });

  it("fails the turn on invalid JSON or a missing risk flag", () => {
    expect(parseAiOutput("not json", patientIds).ok).toBe(false);
    expect(parseAiOutput(JSON.stringify({ reply: "hi", extracted: [] }), patientIds).ok).toBe(false);
  });

  it("keeps the hand-written JSON schema in sync with the zod contract", () => {
    expect([...aiTurnOutputJsonSchema.required].sort()).toEqual(Object.keys(AiTurnOutput.shape).sort());
    expect(aiTurnOutputJsonSchema.properties.extracted.items.properties.field.enum).toEqual(FieldName.options);
  });
});

describe("vignette contract", () => {
  const example = {
    id: "V001",
    version: "1.0",
    author: "psychiatrist",
    demographics: { gender: "female", ageBand: "25-34", nationality: "Emirati", languageVariety: "native English" },
    path: "full",
    opening: "My chest feels tight all the time and I can't switch off at night.",
    followUps: ["About two months.", "I keep missing deadlines at work."],
    answers: { PHQ9: [1, 1, 2, 1, 1, 0, 1, 0, 0], GAD7: [2, 2, 2, 1, 1, 2, 1] },
    gold: {
      step: 3,
      redFlagRuleIds: [],
      fields: { presenting_complaint: "tight chest, can't switch off", duration: "about two months" },
    },
  };

  it("accepts a valid example", () => {
    const result = Vignette.safeParse(example);
    expect(result.error?.issues).toBeUndefined();
  });

  it("requires a red-flag case to have gold step 'urgent'", () => {
    const redFlag = { ...example, gold: { ...example.gold, redFlagRuleIds: ["RF-PHQ9-ITEM9"] } };
    expect(Vignette.safeParse(redFlag).success).toBe(false);
  });

  it("rejects a PHQ-9 answer list of the wrong length", () => {
    const bad = { ...example, answers: { ...example.answers, PHQ9: [1, 1, 1] } };
    expect(Vignette.safeParse(bad).success).toBe(false);
  });
});
