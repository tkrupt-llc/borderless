// Clip 05: sign in → queue by urgency with clocks → open the clip-01 case → AI summary → quick reply
// "I'll call you today" → Send reply → accept the next step → refer to SEHA primary care → hand-off status.
// Recorded before clip 04, so the patient sees this reply when they come back. Desktop, about 45 s.
// Credentials come from .env.local (DEMO_CLINICIAN_EMAIL / DEMO_CLINICIAN_PASSWORD) and are never logged.
import type { Browser } from "playwright";
import { DESKTOP, click, finishClip, goto, newClip, pause, readState, scroll, settle, staffCredentials, stepper, storagePath, type } from "./lib";

const caseRef = (id: string) => `BL-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

export default async function clip05(browser: Browser) {
  const s = stepper("05-clinician");
  const sid = readState().sessions["01"];
  if (!sid) throw new Error("Run clip 01 first");
  const ref = caseRef(sid);
  const { email, password } = staffCredentials();
  const { context, page } = await newClip(browser, DESKTOP);

  await s.step("sign in", async () => {
    await goto(page, "/staff/login", 800);
    await type(page, page.getByLabel(/email/i), email);
    await type(page, page.getByLabel(/password/i), password);
    await pause(page, 400);
    await click(page, page.getByRole("button", { name: /sign in/i }));
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
  await s.step(`open the case from clip 01 (${ref})`, async () => {
    const link = page.locator("main tbody").getByRole("link", { name: ref });
    if (await link.count()) {
      await click(page, link); // selects the row; the case summary opens beside the queue
      await pause(page, 2500);
      const open = page.getByRole("link", { name: /Assign next step|Open full case/ }).first();
      if (await open.isVisible().catch(() => false)) await click(page, open);
    }
    if (!page.url().includes(`/staff/case/${sid}`)) await goto(page, `/staff/case/${sid}`);
    await page.waitForURL(new RegExp(`/staff/case/${sid}`), { timeout: 90_000 });
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
