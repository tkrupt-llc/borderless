import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluate, factsFromAnswers, type Facts } from "@/lib/rules/engine";
import { parseRuleFile } from "@/lib/rules/parse";
import { runSafetyRules } from "@/lib/rules/safety";
import { dueAt, highestTier } from "@/lib/rules/tiers";
import { PATHS, stepsFor } from "@/lib/check/paths";

const redFlags = parseRuleFile(readFileSync("content/rules/red-flags.yaml", "utf8"));
const bpdAdhd = parseRuleFile(readFileSync("content/rules/bpd-adhd.yaml", "utf8"));
const run = (facts: Facts) => runSafetyRules({ redFlags, bpdAdhd }, facts);

describe("facts from answers", () => {
  it("exposes the value and a yes/no for each item", () => {
    expect(factsFromAnswers({ "PHQ9-9": 2, "QC_SUICIDE-1": 0 })).toEqual({
      "item.PHQ9.9": 2,
      "answer.PHQ9.9": true,
      "item.QC_SUICIDE.1": 0,
      "answer.QC_SUICIDE.1": false,
    });
  });
});

describe("condition evaluation", () => {
  it("never matches a missing fact", () => {
    expect(evaluate({ fact: "item.PHQ9.9", op: "<", value: 1 }, {})).toBe(false);
  });
  it("handles all / any", () => {
    const facts = { "item.A.1": 1, "item.B.1": 0 };
    const a = { fact: "item.A.1", op: ">", value: 0 } as const;
    const b = { fact: "item.B.1", op: ">", value: 0 } as const;
    expect(evaluate({ all: [a, b] }, facts)).toBe(false);
    expect(evaluate({ any: [a, b] }, facts)).toBe(true);
  });
});

describe("rule files", () => {
  it("reject a fact that names an item not in the item bank", () => {
    const bad = `ruleset: red_flags\nversion: "x"\nowner: p\nrules:\n  - id: RF-TYPO\n    description: typo\n    when: { fact: answer.ASQ.9, op: "==", value: true }\n    then: [{ action: takeover_session }]\n`;
    expect(() => parseRuleFile(bad)).toThrow(/does not match any item/);
  });
});

// One fixture per red-flag rule: the answers that must fire it and the tier expected.
const RED_FLAG_CASES: Record<string, { facts: Facts; tier: string }> = {
  "RF-PHQ9-ITEM9": { facts: factsFromAnswers({ "PHQ9-9": 1 }), tier: "urgent" },
  "RF-QC-SUICIDE-YES": { facts: factsFromAnswers({ "QC_SUICIDE-1": 1 }), tier: "urgent" },
  "RF-ASQ-POSITIVE": { facts: factsFromAnswers({ "ASQ-1": 0, "ASQ-2": 0, "ASQ-3": 0, "ASQ-4": 1 }), tier: "imminent" },
  "RF-ASQ-ACUTE": { facts: factsFromAnswers({ "ASQ-5": 1 }), tier: "imminent" },
  "RF-CSSRS-HIGH": { facts: factsFromAnswers({ "CSSRS_SCREENER-7": 1 }), tier: "imminent" },
  "RF-CSSRS-PAST-BEHAVIOUR": { facts: factsFromAnswers({ "CSSRS_SCREENER-6": 1 }), tier: "urgent" },
  "RF-RED-SELF-HARM": { facts: factsFromAnswers({ "RED_FLAG-1": 1 }), tier: "urgent" },
  "RF-RED-PSYCHOSIS": { facts: factsFromAnswers({ "RED_FLAG-2": 1 }), tier: "urgent" },
  "RF-RED-MANIA": { facts: factsFromAnswers({ "RED_FLAG-3": 1 }), tier: "urgent" },
  "RF-RED-UNSAFE": { facts: factsFromAnswers({ "RED_FLAG-4": 1 }), tier: "imminent" },
  "RF-RED-HARM-OTHERS": { facts: factsFromAnswers({ "RED_FLAG-5": 1 }), tier: "imminent" },
  "RF-RED-CHILD-RISK": { facts: factsFromAnswers({ "RED_FLAG-6": 1 }), tier: "urgent" },
  "RF-SAFETY-CHECK": { facts: { "flag.safety_check_positive": true }, tier: "urgent" },
  "RF-HELP-NOW": { facts: { "flag.help_now": true }, tier: "urgent" },
};

describe("red-flag rules: one test per rule", () => {
  it("every rule in the file has a test case (a new rule without one fails here)", () => {
    expect(redFlags.rules.map((r) => r.id).sort()).toEqual(Object.keys(RED_FLAG_CASES).sort());
  });

  it.each(Object.entries(RED_FLAG_CASES))("%s fires, takes over, and creates the right tier", (id, { facts, tier }) => {
    const result = run(facts);
    expect(result.firedRuleIds).toContain(id);
    expect(result.takeover).toBe(true);
    expect(result.tier).toBe(tier);
  });

  it("all 'no' / zero answers fire nothing", () => {
    const zero = Object.fromEntries(
      ["PHQ9", "QC_SUICIDE", "ASQ", "CSSRS_SCREENER", "RED_FLAG"].flatMap((inst) =>
        Array.from({ length: 9 }, (_, i) => [`${inst}-${i + 1}`, 0]),
      ),
    );
    expect(run(factsFromAnswers(zero))).toMatchObject({ firedRuleIds: [], takeover: false, tier: null });
  });

  it("PHQ-9 item 9 then a positive ASQ raises the clock to imminent", () => {
    const result = run(factsFromAnswers({ "PHQ9-9": 2, "ASQ-1": 1 }));
    expect(result.firedRuleIds).toEqual(["RF-PHQ9-ITEM9", "RF-ASQ-POSITIVE"]);
    expect(result.tier).toBe("imminent");
    expect(result.actions).toContainEqual({ action: "run_instrument", instrument: "CSSRS_SCREENER" });
  });
});

describe("BPD and ADHD rules", () => {
  const history = { "history.bpd": true };

  it("do nothing without a known history, whatever the answers", () => {
    const result = run(factsFromAnswers({ "BPD_ADHD_EXTRA-1": 1, "BPD_ADHD_EXTRA-3": 1 }));
    expect(result.firedRuleIds).toEqual([]);
  });

  it("ask the four extra questions when the history is known", () => {
    expect(run({ "history.adhd": true }).actions).toContainEqual({
      action: "run_instrument",
      instrument: "BPD_ADHD_EXTRA",
    });
  });

  it("send a change from usual to urgent", () => {
    const result = run({ ...history, ...factsFromAnswers({ "BPD_ADHD_EXTRA-1": 1 }) });
    expect(result.firedRuleIds).toContain("BA-CHANGE-FROM-USUAL");
    expect(result.tier).toBe("urgent");
  });

  it("treat self-harm or strong urges this week as a takeover", () => {
    const result = run({ ...history, ...factsFromAnswers({ "BPD_ADHD_EXTRA-2": 1 }) });
    expect(result.takeover).toBe(true);
    expect(result.tier).toBe("urgent");
  });

  it("never lower the tier: an imminent red flag stays imminent with a known history", () => {
    const result = run({ ...history, ...factsFromAnswers({ "ASQ-5": 1, "BPD_ADHD_EXTRA-1": 0 }) });
    expect(result.tier).toBe("imminent");
  });
});

describe("tiers and clocks", () => {
  it("the highest tier wins", () => {
    expect(
      highestTier([
        { action: "create_task", tier: "elevated" },
        { action: "create_task", tier: "imminent" },
        { action: "create_task", tier: "urgent" },
      ]),
    ).toBe("imminent");
  });

  it("imminent is 15 minutes, urgent is 4 hours", () => {
    const from = new Date("2026-11-12T10:00:00");
    expect(dueAt("imminent", from).getTime() - from.getTime()).toBe(15 * 60_000);
    expect(dueAt("urgent", from).getTime() - from.getTime()).toBe(4 * 3_600_000);
  });

  it("elevated skips the weekend: Friday goes to Monday", () => {
    const due = dueAt("elevated", new Date("2026-11-13T10:00:00")); // Friday
    expect(due.getDay()).toBe(1);
  });
});

describe("check-in paths", () => {
  it("quick check is 5 questions ending with the suicide question", () => {
    const steps = stepsFor("quick");
    expect(steps).toHaveLength(5);
    expect(steps.at(-1)?.item.id).toBe("QC_SUICIDE-1");
  });

  it("full check-in is PHQ-9 (with its unscored item 10) + GAD-7, with PHQ-9 item 9 included", () => {
    const ids = stepsFor("full").map((s) => s.item.id);
    expect(ids).toHaveLength(17);
    expect(ids).toContain("PHQ9-9");
    expect(ids).toContain("PHQ9-10");
  });

  it("every answer value fits the server's 0-3 check", () => {
    for (const path of Object.keys(PATHS) as (keyof typeof PATHS)[]) {
      for (const step of stepsFor(path)) {
        for (const option of step.item.options) {
          expect(option.value).toBeGreaterThanOrEqual(0);
          expect(option.value).toBeLessThanOrEqual(3);
        }
      }
    }
  });
});
