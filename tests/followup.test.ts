import { describe, expect, it } from "vitest";
import { derivedScreens, newFollowUpToken, notOnTrack, TOKEN_PATTERN } from "@/lib/followup/trend";

describe("derivedScreens", () => {
  it("works out PHQ-2 and GAD-2 from the first two PHQ-9 and GAD-7 answers", () => {
    const answers = { "PHQ9-1": 2, "PHQ9-2": 1, "PHQ9-3": 3, "GAD7-1": 0, "GAD7-2": 1, "GAD7-3": 3 };
    const [phq2, gad2] = derivedScreens(answers);
    expect(phq2).toMatchObject({ instrument: "PHQ2", total: 3, band: "positive" });
    expect(gad2).toMatchObject({ instrument: "GAD2", total: 1, band: "negative" });
  });

  it("returns nothing for a screen whose items are missing, never a guess", () => {
    expect(derivedScreens({ "PHQ9-1": 2 })).toEqual([]);
  });
});

describe("notOnTrack", () => {
  it("flags a reliable rise in PHQ-9 (6 or more) and GAD-7 (5 or more)", () => {
    const reasons = notOnTrack(
      [{ instrument: "PHQ9", total: 8, band: "mild" }, { instrument: "GAD7", total: 6, band: "mild" }],
      [{ instrument: "PHQ9", total: 14, band: "moderate" }, { instrument: "GAD7", total: 11, band: "moderate" }],
    );
    expect(reasons).toHaveLength(2);
  });

  it("does not flag smaller changes or improvement", () => {
    expect(
      notOnTrack(
        [{ instrument: "PHQ9", total: 8, band: "mild" }, { instrument: "GAD7", total: 12, band: "moderate" }],
        [{ instrument: "PHQ9", total: 13, band: "moderate" }, { instrument: "GAD7", total: 4, band: "minimal" }],
      ),
    ).toEqual([]);
  });

  it("flags a two-item screen going from negative to positive", () => {
    const reasons = notOnTrack([{ instrument: "PHQ2", total: 1, band: "negative" }], [{ instrument: "PHQ2", total: 4, band: "positive" }]);
    expect(reasons[0]).toContain("negative to positive");
  });

  it("only compares the same instrument", () => {
    expect(notOnTrack([{ instrument: "PHQ2", total: 0, band: "negative" }], [{ instrument: "PHQ9", total: 20, band: "severe" }])).toEqual([]);
  });
});

describe("newFollowUpToken", () => {
  it("is random and matches the accepted pattern", () => {
    const a = newFollowUpToken();
    expect(a).toMatch(TOKEN_PATTERN);
    expect(newFollowUpToken()).not.toBe(a);
  });
});
