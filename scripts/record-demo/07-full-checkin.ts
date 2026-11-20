// Clip 07: the full check-in with AI help: consent (care team + AI help) → a short chat with the live
// AI assistant → Continue to the questions → the first PHQ-9 questions. Phone size, about 25 s raw.
import type { Browser } from "playwright";
import { PHONE, click, finishClip, goto, newClip, pause, sessionIdOf, settle, stepper, type, writeState } from "./lib";

export default async function clip07(browser: Browser) {
  const s = stepper("07-full-checkin");
  const { context, page } = await newClip(browser, PHONE);
  const assistantTurns = () => page.locator('ol[aria-label="Conversation"] > li').count();

  await s.step("consent: care team + AI help", async () => {
    await goto(page, "/check/full/consent", 900);
    for (const box of await page.getByRole("checkbox").all()) {
      if (!(await box.isChecked())) {
        await click(page, box);
        await pause(page, 300);
      }
    }
    await click(page, page.getByRole("button", { name: /let's start/i }));
    await page.waitForURL(/\/check\/full\/chat/, { timeout: 90_000 });
    await settle(page, 1200);
  });

  const say = async (text: string) => {
    const before = await assistantTurns();
    await type(page, page.locator("textarea:visible").first(), text);
    await pause(page, 300);
    await click(page, page.getByRole("button", { name: "Send", exact: true }));
    // Wait for the person's message and the assistant's reply to appear.
    await page.waitForFunction(
      (n) => document.querySelectorAll('ol[aria-label="Conversation"] > li').length >= n + 2,
      before,
      { timeout: 60_000 },
    );
    await settle(page, 1800);
  };

  await s.step("chat: first message", () => say("I've been feeling low and not sleeping well for a few weeks."));
  await s.step("chat: second message", () => say("Mostly work stress. It's hard to switch off at night."));
  await s.step("Continue to the questions", async () => {
    await click(page, page.getByRole("button", { name: /Continue to the questions|Move to the questions/ }));
    await page.waitForURL(/\/check\/full\/1$/, { timeout: 90_000 });
    await settle(page, 1200);
  });
  await s.step("first PHQ-9 questions", async () => {
    await click(page, page.getByRole("radio", { name: "Several days", exact: true }));
    await page.waitForURL(/\/check\/full\/2$/, { timeout: 60_000 });
    await settle(page, 1500);
  });

  const sid = await sessionIdOf(context);
  writeState((st) => {
    if (sid) st.sessions["07"] = sid;
  });
  s.save();
  return finishClip(context, page, "07-full-checkin");
}
