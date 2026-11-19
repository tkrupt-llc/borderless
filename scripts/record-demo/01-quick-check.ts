// Clip 01: landing → Quick check → low-to-moderate answers → result. Desktop, about 30 s.
import type { Browser } from "playwright";
import { DESKTOP, click, finishClip, goto, newClip, pause, scroll, sessionIdOf, settle, startQuickCheck, answerQuickCheck, stepper, type, writeState } from "./lib";

export default async function clip01(browser: Browser) {
  const s = stepper("01-quick-check");
  const { context, page } = await newClip(browser, DESKTOP);

  await s.step("landing", () => goto(page, "/", 1500));
  await s.step("scroll the landing a little", async () => {
    await scroll(page, 360);
    await pause(page, 900);
    await scroll(page, -360);
    await pause(page, 500);
  });
  // The landing's main button goes straight to the quick check's consent page.
  await s.step("Start a 2-minute check-in", () => click(page, page.getByRole("link", { name: /Start a 2-minute check-in/ }).first()));
  await s.step("consent", () => startQuickCheck(page));
  await s.step("answer the questions", () => answerQuickCheck(page, ["Several days", "Not at all", "More than half the days", "Several days", "No"]));
  await s.step("physical health: skip", async () => {
    await page.waitForURL(/\/health/);
    await settle(page);
    await click(page, page.getByRole("link", { name: "Skip", exact: true }));
  });
  await s.step("contact: SMS, a demo number, weekday evenings", async () => {
    await page.waitForURL(/\/contact/);
    await settle(page);
    await click(page, page.getByRole("radio", { name: "SMS", exact: true }));
    await pause(page, 500);
    await type(page, page.getByLabel("Your phone number"), "050 000 0000");
    await pause(page, 400);
    await click(page, page.getByRole("checkbox", { name: "Weekday evenings" }));
    await pause(page, 700);
    await click(page, page.getByRole("button", { name: /Save and see my results/ }));
  });
  await s.step("result", async () => {
    await page.waitForURL(/\/result/);
    await settle(page, 1500);
    await scroll(page, 520);
    await pause(page, 1200);
    await scroll(page, 520);
    await pause(page, 1200);
  });

  const sid = await sessionIdOf(context);
  writeState((st) => {
    if (sid) st.sessions["01"] = sid;
  });
  s.save();
  return finishClip(context, page, "01-quick-check");
}
