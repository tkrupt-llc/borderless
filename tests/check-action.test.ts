import { describe, expect, it } from "vitest";
import { checkAnswers, finishCheckIn, startCheckIn } from "@/app/(patient)/check/actions";
import { stepsFor } from "@/lib/check/paths";

// End to end through the server actions with real rule files and item bank.
// Tests run without Supabase keys, so nothing is saved (the no-database mode).
describe("checkAnswers server action", () => {
  it("'yes' to the quick-check suicide question takes over", async () => {
    const answers = { "PHQ2-1": 0, "PHQ2-2": 0, "GAD2-1": 0, "GAD2-2": 0, "QC_SUICIDE-1": 1 };
    expect(await checkAnswers({ path: "quick", answers })).toEqual({ ok: true, takeover: true });
  });

  it("PHQ-9 item 9 above zero takes over on the full path", async () => {
    expect(await checkAnswers({ path: "full", answers: { "PHQ9-9": 1 } })).toEqual({ ok: true, takeover: true });
  });

  it("high scores without a red flag do not take over", async () => {
    const answers = { "PHQ2-1": 3, "PHQ2-2": 3, "GAD2-1": 3, "GAD2-2": 3, "QC_SUICIDE-1": 0 };
    expect(await checkAnswers({ path: "quick", answers })).toEqual({ ok: true, takeover: false });
  });

  it("ignores answers to items that are not on the path", async () => {
    expect(await checkAnswers({ path: "quick", answers: { "PHQ9-9": 3 } })).toEqual({ ok: true, takeover: false });
  });

  it("refuses an unknown path, a bad value, or junk input", async () => {
    const invalid = { ok: false, reason: "invalid" };
    expect(await checkAnswers({ path: "nope", answers: {} })).toEqual(invalid);
    expect(await checkAnswers({ path: "quick", answers: { "QC_SUICIDE-1": 2 } })).toEqual(invalid);
    expect(await checkAnswers("junk")).toEqual(invalid);
  });
});

describe("finishCheckIn server action", () => {
  const all = (path: "quick" | "full", value: number) =>
    Object.fromEntries(stepsFor(path).map((s) => [s.item.id, s.item.instrument === "QC_SUICIDE" ? 0 : value]));

  it("scores only the instruments on the path", async () => {
    const result = await finishCheckIn({ path: "quick", answers: all("quick", 2) });
    expect(result.ok && result.scores.map((s) => [s.instrument, s.total, s.positive])).toEqual([
      ["PHQ2", 4, true],
      ["GAD2", 4, true],
    ]);
  });

  it("gives the full check-in its PHQ-9 and GAD-7 bands", async () => {
    const result = await finishCheckIn({ path: "full", answers: all("full", 1) });
    expect(result.ok && result.scores.map((s) => [s.instrument, s.band])).toEqual([
      ["PHQ9", "mild"],
      ["GAD7", "mild"],
    ]);
  });

  it("refuses an unfinished check-in", async () => {
    expect(await finishCheckIn({ path: "quick", answers: { "PHQ2-1": 0 } })).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("startCheckIn server action", () => {
  it("accepts a known path and refuses an unknown one", async () => {
    expect(await startCheckIn({ path: "quick", discreet: false, consents: { clinician_review: true } })).toEqual({
      ok: true,
    });
    expect(await startCheckIn({ path: "x", discreet: false, consents: {} })).toEqual({ ok: false, reason: "invalid" });
  });
});
