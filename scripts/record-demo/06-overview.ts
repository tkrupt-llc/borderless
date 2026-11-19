// Clip 06: service overview, scrolled slowly top to bottom. Desktop, about 25 s.
// Reuses the clinician sign-in saved by clip 05.
import { existsSync } from "node:fs";
import type { Browser } from "playwright";
import { DESKTOP, finishClip, goto, newClip, pause, scrollToBottom, stepper, storagePath } from "./lib";

export default async function clip06(browser: Browser) {
  const s = stepper("06-overview");
  if (!existsSync(storagePath("staff"))) throw new Error("Run clip 05 first (it saves the clinician sign-in)");
  const { context, page } = await newClip(browser, DESKTOP, { storageState: storagePath("staff") });

  await s.step("service overview", async () => {
    await goto(page, "/staff/insights", 2500);
    await page.getByRole("heading", { name: /Outcomes/ }).first().waitFor({ timeout: 90_000 });
    await page.mouse.move(960, 400, { steps: 10 });
    await pause(page, 2500);
  });
  await s.step("scroll slowly to the bottom", async () => {
    await scrollToBottom(page, 20_000);
    await pause(page, 3000);
  });

  s.save();
  return finishClip(context, page, "06-overview");
}
