import { describe, expect, it } from "vitest";
import { checkPhrases, normalise } from "@/lib/rules/phrases";

describe("phrase check: should trigger a check question", () => {
  it.each([
    ["I just want to end it all", "end it all"],
    ["Honestly I WISH I WAS DEAD most days", "wish i was dead"],
    ["I've been cutting myself again", "cutting myself"],
    ["I can’t go on like this", "cant go on"], // curly apostrophe
    ["been thinking about suicide lately...", "suicide"],
  ])("%s", (text, phrase) => {
    expect(checkPhrases(text).matched).toContain(phrase);
  });
});

describe("phrase check: should not trigger", () => {
  it.each([
    "This traffic is killing me",
    "I'm dying to see the match on Friday",
    "I cut my finger while cooking",
    "I'm dead tired after work",
    "My skills at work are improving",
  ])("%s", (text) => {
    expect(checkPhrases(text).matched).toEqual([]);
  });
});

describe("normalise", () => {
  it("lower-cases, drops apostrophes and turns punctuation into spaces", () => {
    expect(normalise("Don’t-want   to WAKE up!!")).toBe("dont want to wake up");
  });
});
