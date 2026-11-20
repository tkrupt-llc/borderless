// Clip 05 (as the guest, demo cases only): Continue as guest → reset the demo cases → queue by urgency
// with clocks → open a demo full check-in → AI summary → quick reply "I'll call you today" → Send reply →
// accept the next step → refer to SEHA primary care → hand-off status. Desktop, about 45 s.
// No email or password is typed: the guest button signs in on the server.
import type { Browser } from "playwright";
import { DESKTOP, click, finishClip, goto, newClip, pause, scroll, settle, stepper, storagePath } from "./lib";

export default async function clip05(browser: Browser) {
  const s = stepper("05-clinician");
  const { context, page } = await newClip(browser, DESKTOP);

  await s.step("Continue as guest", async () => {
    await goto(page, "/staff/login", 800);
    await click(page, page.getByRole("button", { name: "Continue as guest" }));
    await page.getByRole("heading", { name: /Review queue/ }).waitFor({ timeout: 90_000 });
    await settle(page, 800);
  });
  await s.step("reset the demo cases (same start every recording)", async () => {
    await click(page, page.getByRole("button", { name: "Reset demo data" }));
    await page.waitForTimeout(4000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /Review queue/ }).waitFor({ timeout: 90_000 });
    await settle(page, 1800);
  });
  await s.step("queue: urgency and reply-by clocks", async () => {
    const rows = page.locator("main tbody tr:visible");
    const n = Math.min(await rows.count(), 4);
    for (let i = 0; i < n; i++) {
      const box = await rows.nth(i).boundingBox();
      if (box) await page.mouse.move(box.x + box.width - 160, box.y + box.height / 2, { steps: 12 });
      await pause(page, 450);
    }
    await pause(page, 600);
  });
  await s.step("open the demo full check-in (PHQ-9 7, GAD-7 6)", async () => {
    const row = page.locator("main tbody tr:visible").filter({ hasText: "PHQ-9 7 · GAD-7 6" }).first();
    await click(page, row.getByRole("link").first()); // selects the row; the summary opens beside the queue
    await pause(page, 2500);
    await click(page, page.getByRole("link", { name: /Assign next step|Open full case/ }).first());
    await page.waitForURL(/\/staff\/case\//, { timeout: 90_000 });
    await settle(page, 1500);
  });
  await s.step("AI summary", async () => {
    const heading = page.getByRole("heading", { name: /Summary/ }).first();
    await heading.scrollIntoViewIfNeeded();
    const box = await heading.boundingBox();
    if (box) await page.mouse.move(box.x + 300, box.y + 90, { steps: 15 });
    await pause(page, 2500);
    const sign = page.getByRole("button", { name: /Sign summary/ });
    if (await sign.isVisible().catch(() => false)) {
      await click(page, sign);
      await settle(page, 1200);
    }
  });
  await s.step('quick reply "I\'ll call you today" → Send reply', async () => {
    await click(page, page.getByRole("button", { name: "I'll call you today" }));
    await pause(page, 1200);
    await click(page, page.getByRole("button", { name: /Send reply/ }));
    await page.getByText(/Sent\. The patient sees it/).waitFor({ timeout: 30_000 });
    await settle(page, 1200);
  });
  await s.step("accept the next step", async () => {
    await click(page, page.getByRole("button", { name: /Accept proposed step|Accept urgent pathway/ }).first());
    await settle(page, 1500);
  });
  await s.step("refer to SEHA primary care", async () => {
    const card = page.locator("li, article, div").filter({ hasText: /SEHA primary care/ }).filter({ has: page.getByRole("button", { name: /Refer to this service/ }) }).last();
    const refer = (await card.count()) ? card.getByRole("button", { name: /Refer to this service/ }) : page.getByRole("button", { name: /Refer to this service/ }).first();
    await refer.scrollIntoViewIfNeeded();
    await pause(page, 1200);
    await click(page, refer);
    await page.getByRole("button", { name: /Mark booked/ }).waitFor({ timeout: 60_000 });
    await settle(page, 1000);
  });
  await s.step("referral status", async () => {
    const handoff = page.getByRole("heading", { name: /^Hand-off$/ }).first();
    await handoff.scrollIntoViewIfNeeded();
    const box = await handoff.boundingBox();
    if (box) await page.mouse.move(box.x + 260, box.y + 70, { steps: 15 });
    await pause(page, 2500);
    await scroll(page, 160);
    await pause(page, 1500);
  });

  // Keep the staff sign-in for clip 06 (git-ignored output folder).
  await context.storageState({ path: storagePath("staff") });
  s.save();
  return finishClip(context, page, "05-clinician");
}
