// Clip 04: the return code on the timeline → a "new device" → /return → enter it → welcome-back banner.
// Uses the check-in from clip 03. Desktop, about 15 s.
import { readFileSync } from "node:fs";
import type { Browser, Page } from "playwright";
import { DESKTOP, click, finishClip, goto, newClip, pause, readState, scroll, settle, stepper, storagePath, type } from "./lib";

async function readCode(page: Page) {
  return page.evaluate(() => {
    for (let i = 0; i < sessionStorage.length; i++) {
      try {
        const v = JSON.parse(sessionStorage.getItem(sessionStorage.key(i)!) ?? "null");
        if (v?.sessionId && v?.returnCode) return { sessionId: v.sessionId as string, code: v.returnCode as string };
      } catch {}
    }
    return null;
  });
}

export default async function clip04(browser: Browser) {
  const s = stepper("04-return");
  const sid = readState().sessions["03"];
  if (!sid) throw new Error("Run clip 03 first");
  const { context, page } = await newClip(browser, DESKTOP, {
    storageState: storagePath("03"),
    sessionStorage: JSON.parse(readFileSync(storagePath("03-tab"), "utf8")) as Record<string, string>,
  });

  let ref = "";
  let code = "";
  await s.step("show the return code", async () => {
    await goto(page, `/check/done/${sid}`, 600);
    const note = page.getByText("Keep these to come back");
    await note.scrollIntoViewIfNeeded();
    await pause(page, 300);
    await scroll(page, 120);
    await pause(page, 1800);
    const stored = await readCode(page);
    if (!stored) throw new Error("no return code stored");
    code = stored.code;
    ref = (await page.locator("main").getByText(/BL-[A-Z0-9]{6}/).first().textContent())?.match(/BL-[A-Z0-9]{6}/)?.[0] ?? "";
    if (!ref) throw new Error("reference not found");
  });
  await s.step("forget this browser (like a new device)", async () => {
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem("__seeded", "1"); // don't re-seed the old tab state
    });
  });
  await s.step("go to /return and enter the code", async () => {
    await goto(page, "/return", 800);
    await type(page, page.getByLabel(/Reference/i), ref);
    await pause(page, 300);
    await type(page, page.getByLabel(/Return code/i), code);
    await pause(page, 500);
    await click(page, page.locator("main form button[type=submit]:visible").first());
    await page.waitForURL(/\/check\/done\//, { timeout: 60_000 });
    await settle(page, 1500);
  });
  await s.step("welcome-back banner", async () => {
    await goto(page, "/", 600);
    await page.getByRole("region", { name: "Welcome back" }).or(page.getByLabel("Welcome back")).first().waitFor();
    await pause(page, 2500);
  });

  s.save();
  return finishClip(context, page, "04-return");
}
