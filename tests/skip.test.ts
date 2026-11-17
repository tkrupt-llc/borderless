import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canSkip, SKIPPED, splitSkips } from "@/lib/check/skip";
import { allAskedAnswered } from "@/lib/check/conditions";
import { stepsFor } from "@/lib/check/paths";
import { scoreAll } from "@/lib/rules/scoring";

// Every item a red-flag rule reads ("item.PHQ9.9", "answer.ASQ.1", ...) must stay required.
const ruleItems = [...readFileSync("content/rules/red-flags.yaml", "utf8").matchAll(/fact: (?:item|answer)\.([A-Z0-9_]+)\.(\d+)/g)].map(
  (m) => `${m[1]}-${m[2]}`,
);

describe("Prefer not to say", () => {
  it("is never offered on a question a safety rule reads", () => {
    expect(ruleItems.length).toBeGreaterThan(5);
    for (const id of ruleItems) expect(canSkip(id), id).toBe(false);
  });

  it("is offered on ordinary mood and worry questions", () => {
    expect(canSkip("PHQ9-3")).toBe(true);
    expect(canSkip("GAD7-1")).toBe(true);
    expect(canSkip("PHQ9-9")).toBe(false);
  });

  it("counts as asked but is never scored", () => {
    const ids = stepsFor("full").map((s) => s.item.id);
    const all = Object.fromEntries(ids.map((id) => [id, id === "PHQ9-3" ? SKIPPED : 1]));
    expect(allAskedAnswered(ids, all)).toBe(true);
    const { answers, skipped } = splitSkips(all);
    expect(skipped).toEqual(["PHQ9-3"]);
    const scores = scoreAll(answers).map((s) => s.instrument);
    expect(scores).not.toContain("PHQ9"); // a skipped item means no PHQ-9 total, never a guess
    expect(scores).toContain("GAD7");
  });
});
