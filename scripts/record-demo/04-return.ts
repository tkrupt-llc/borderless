// Clip 04 (record AFTER 05): the person comes back on a phone with nothing saved → menu → Coming back? →
// reference + return code → the clinician's reply under "Messages with your care team" → timeline →
// "Your next step" card → Have you booked? Yes → date → Save. Uses the check-in from clip 01. About 25 s.
import { readFileSync } from "node:fs";
import type { Browser } from "playwright";
import { PHONE, click, finishClip, goto, newClip, pause, readState, scroll, settle, stepper, storagePath, type } from "./lib";

const caseRef = (id: string) => `BL-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

/** The return code clip 01's tab stored after the check-in was sent. */
function returnCodeFromClip01(): string {
  const tab = JSON.parse(readFileSync(storagePath("01-tab"), "utf8")) as Record<string, string>;
  for (const v of Object.values(tab)) {
    try {
      const r = JSON.parse(v);
      if (r?.returnCode) return r.returnCode as string;
    } catch {}
  }
  throw new Error("No return code saved by clip 01");
}

export default async function clip04(browser: Browser) {
  const s = stepper("04-return");
  const sid = readState().sessions["01"];
  if (!sid) throw new Error("Run clip 01 first");
  const ref = caseRef(sid);
  const code = returnCodeFromClip01();
  const { context, page } = await newClip(browser, PHONE); // a fresh phone: no cookie, nothing stored

  await s.step("home", () => goto(page, "/", 1200));
  await s.step("menu → Coming back?", async () => {
    const menu = page.locator("header button[aria-controls]");
    if (await menu.isVisible().catch(() => false)) {
      await click(page, menu);
      await pause(page, 900);
      await click(page, page.locator("header nav").getByRole("link", { name: "Coming back?" }).last());
    } else {
      await click(page, page.getByRole("link", { name: /Coming back\?/ }).first());
    }
    await page.waitForURL(/\/return/);
    await settle(page, 900);
  });
  await s.step("enter the reference and return code", async () => {
    await type(page, page.getByLabel(/Reference/i), ref);
    await pause(page, 300);
    await type(page, page.getByLabel(/Return code/i), code);
    await pause(page, 600);
    await click(page, page.locator("main form button[type=submit]:visible").first());
    await page.waitForURL(/\/check\/done\//, { timeout: 60_000 });
    await settle(page, 1200);
  });
  await s.step("the reply under Messages with your care team", async () => {
    const msgs = page.getByText("Messages with your care team");
    await msgs.scrollIntoViewIfNeeded();
    await scroll(page, 120);
    await pause(page, 2500);
  });
  await s.step("timeline", async () => {
    await page.evaluate(() => scrollTo({ top: 0 }));
    await pause(page, 400);
    await scroll(page, 380);
    await pause(page, 1500);
  });
  await s.step('"Your next step" → Have you booked? Yes', async () => {
    const asked = page.getByText("Have you booked?");
    await asked.scrollIntoViewIfNeeded();
    await scroll(page, 140);
    await pause(page, 1500);
    await click(page, page.getByRole("button", { name: "Yes", exact: true }));
    await pause(page, 700);
    const date = page.getByLabel(/Appointment date/);
    await click(page, date);
    await date.fill(new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10));
    await pause(page, 600);
    await click(page, page.getByRole("button", { name: "Save", exact: true }));
    await page.getByText(/Your appointment is on/).waitFor({ timeout: 30_000 });
    await pause(page, 2500);
  });

  s.save();
  return finishClip(context, page, "04-return");
}
