import { describe, expect, it } from "vitest";
import { allAskedAnswered, isAsked, nextAskedIndex } from "@/lib/check/conditions";
import { stepsFor } from "@/lib/check/paths";

const ids = stepsFor("safety").map((s) => s.item.id);
const no4 = { "ASQ-1": 0, "ASQ-2": 0, "ASQ-3": 0, "ASQ-4": 0 };

describe("safety screen order", () => {
  it("asks the ASQ, then the C-SSRS screener", () => {
    expect(ids.slice(0, 5)).toEqual(["ASQ-1", "ASQ-2", "ASQ-3", "ASQ-4", "ASQ-5"]);
    expect(ids[5]).toBe("CSSRS_SCREENER-1");
  });

  it("stops after four no's: no acuity question, no C-SSRS", () => {
    expect(nextAskedIndex(ids, 3, no4)).toBeNull();
    expect(allAskedAnswered(ids, no4)).toBe(true);
  });

  it("asks the acuity question and the C-SSRS after any yes", () => {
    const a = { ...no4, "ASQ-2": 1 };
    expect(ids[nextAskedIndex(ids, 3, a)!]).toBe("ASQ-5");
    expect(ids[nextAskedIndex(ids, 4, { ...a, "ASQ-5": 0 })!]).toBe("CSSRS_SCREENER-1");
    expect(allAskedAnswered(ids, a)).toBe(false);
  });

  it("skips C-SSRS items 3-5 after a no to item 2, and item 7 after a no to item 6", () => {
    const a = { ...no4, "ASQ-1": 1, "ASQ-5": 0, "CSSRS_SCREENER-1": 1, "CSSRS_SCREENER-2": 0 };
    expect(ids[nextAskedIndex(ids, ids.indexOf("CSSRS_SCREENER-2"), a)!]).toBe("CSSRS_SCREENER-6");
    const done = { ...a, "CSSRS_SCREENER-6": 0 };
    expect(nextAskedIndex(ids, ids.indexOf("CSSRS_SCREENER-6"), done)).toBeNull();
    expect(allAskedAnswered(ids, done)).toBe(true);
  });

  it("asks items 3-5 after a yes to item 2", () => {
    expect(isAsked("CSSRS_SCREENER-4", { "ASQ-3": 1, "CSSRS_SCREENER-2": 1 })).toBe(true);
  });
});
