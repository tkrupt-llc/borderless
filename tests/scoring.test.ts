import { describe, expect, it } from "vitest";
import { factsFromScores, score, scoreAll } from "@/lib/rules/scoring";

/** Answers that add up to `total` across n items with max 3 each. */
function answersFor(instrument: string, n: number, total: number): Record<string, number> {
  const out: Record<string, number> = {};
  let left = total;
  for (let i = 1; i <= n; i++) {
    const v = Math.min(3, left);
    out[`${instrument}-${i}`] = v;
    left -= v;
  }
  if (left !== 0) throw new Error("total too high");
  return out;
}

describe("PHQ-9 bands, at every boundary", () => {
  it.each([
    [0, "minimal"], [4, "minimal"],
    [5, "mild"], [9, "mild"],
    [10, "moderate"], [14, "moderate"],
    [15, "moderately_severe"], [19, "moderately_severe"],
    [20, "severe"], [27, "severe"],
  ])("total %i is %s", (total, band) => {
    expect(score("PHQ9", answersFor("PHQ9", 9, total))).toEqual({ instrument: "PHQ9", total, band });
  });
});

describe("GAD-7 bands, at every boundary", () => {
  it.each([
    [0, "minimal"], [4, "minimal"],
    [5, "mild"], [9, "mild"],
    [10, "moderate"], [14, "moderate"],
    [15, "severe"], [21, "severe"],
  ])("total %i is %s", (total, band) => {
    expect(score("GAD7", answersFor("GAD7", 7, total))).toEqual({ instrument: "GAD7", total, band });
  });
});

describe("PHQ-2 and GAD-2 gates: positive at 3 or more", () => {
  it.each([
    ["PHQ2", 2, false], ["PHQ2", 3, true], ["PHQ2", 6, true],
    ["GAD2", 2, false], ["GAD2", 3, true], ["GAD2", 0, false],
  ] as const)("%s total %i positive=%s", (instrument, total, positive) => {
    expect(score(instrument, answersFor(instrument, 2, total))).toMatchObject({ total, positive });
  });
});

describe("PHQ-9 item 10 (difficulty)", () => {
  it("is asked but never added to the total", () => {
    const base = answersFor("PHQ9", 9, 12);
    expect(score("PHQ9", { ...base, "PHQ9-10": 3 })).toEqual(score("PHQ9", base));
    expect(score("PHQ9", { ...base, "PHQ9-10": 3 })?.total).toBe(12);
  });
});

describe("incomplete or invalid answers", () => {
  it("does not score a partial PHQ-9", () => {
    const answers = answersFor("PHQ9", 9, 10);
    delete answers["PHQ9-5"];
    expect(score("PHQ9", answers)).toBeNull();
  });

  it("refuses an answer value that is not one of the options", () => {
    expect(() => score("PHQ9", { ...answersFor("PHQ9", 9, 0), "PHQ9-1": 4 })).toThrow(/not a valid answer/);
  });
});

describe("ASQ", () => {
  const no = { "ASQ-1": 0, "ASQ-2": 0, "ASQ-3": 0, "ASQ-4": 0 };

  it("all four 'no' is negative", () => {
    expect(score("ASQ", no)).toMatchObject({ band: "negative", positive: false });
  });

  it("is not scored while screen items are missing and none is 'yes'", () => {
    expect(score("ASQ", { "ASQ-1": 0 })).toBeNull();
  });

  it("one 'yes' is positive immediately, even with other items unanswered", () => {
    expect(score("ASQ", { "ASQ-2": 1 })).toMatchObject({ band: "non_acute_positive", positive: true });
  });

  it("'yes' to the acuity question is an acute positive", () => {
    expect(score("ASQ", { ...no, "ASQ-1": 1, "ASQ-5": 1 })).toMatchObject({ band: "acute_positive", acute: true });
  });
});

describe("score facts for the rule files", () => {
  it("exposes totals, bands and gates", () => {
    const facts = factsFromScores(scoreAll({ ...answersFor("PHQ2", 2, 3), ...answersFor("GAD2", 2, 1) }));
    expect(facts).toMatchObject({
      "score.PHQ2.total": 3,
      "score.PHQ2.positive": true,
      "score.GAD2.total": 1,
      "score.GAD2.positive": false,
    });
  });
});
