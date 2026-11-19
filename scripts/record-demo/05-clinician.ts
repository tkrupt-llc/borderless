// Clip 05: sign in → queue by urgency with clocks → the urgent case from clip 02 → summary → copy a discreet
// message → request the supervisor co-sign → refer and mark the hand-off booked. Desktop, about 50 s.
// Credentials come from .env.local (DEMO_CLINICIAN_EMAIL / DEMO_CLINICIAN_PASSWORD) and are never logged.
import type { Browser, Page } from "playwright";
import { DESKTOP, click, finishClip, goto, newClip, pause, readState, scroll, settle, staffCredentials, stepper, storagePath, type } from "./lib";

const panel = (page: Page, title: RegExp) => page.locator("section, div").filter({ has: page.getByRole("heading", { name: title }) }).last();

export default async function clip05(browser: Browser) {
  const s = stepper("05-clinician");
  const sid = readState().sessions["02"] ?? readState().sessions["01"];
  if (!sid) throw new Error("Run clips 01 and 02 first");
  const { email, password } = staffCredentials();
  const { context, page } = await newClip(browser, DESKTOP);

  await s.step("sign in", async () => {
    await goto(page, "/staff/login", 800);
    await type(page, page.getByLabel(/email/i), email);
    await page.getByLabel(/password/i).fill(""); // typed below, shown as dots
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
    await pause(page, 800);
  });
  await s.step("open the urgent case from clip 02", async () => {
    const row = page.locator("main tbody tr:visible").first();
    await click(page, row);
    await pause(page, 1500);
    const open = page.getByRole("link", { name: /Open full case/ }).first();
    if (await open.isVisible().catch(() => false)) await click(page, open);
    else await goto(page, `/staff/case/${sid}`);
    if (!page.url().includes(sid)) await goto(page, `/staff/case/${sid}`);
    await page.waitForURL(new RegExp(`/staff/case/${sid}`), { timeout: 90_000 });
    await settle(page, 1500);
  });
  await s.step("summary", async () => {
    const heading = page.getByRole("heading", { name: /Summary/ }).first();
    await heading.scrollIntoViewIfNeeded();
    await page.mouse.move(700, 420, { steps: 15 });
    await pause(page, 2000);
    const sign = page.getByRole("button", { name: /Sign summary/ });
    if (await sign.isVisible().catch(() => false)) {
      await click(page, sign);
      await settle(page, 1200);
    }
  });
  await s.step("reply to the patient", async () => {
    await click(page, page.getByRole("button", { name: "Next step agreed" }));
    await pause(page, 900);
    await click(page, page.getByRole("button", { name: /Send reply/ }));
    await page.getByText(/Sent\. The patient sees it/).waitFor({ timeout: 30_000 });
    await settle(page, 1000);
  });
  await s.step("copy discreet message", async () => {
    const copy = page.getByRole("button", { name: /Copy discreet message/ }).first();
    await click(page, copy);
    await page.getByRole("button", { name: /Copied/ }).first().waitFor({ timeout: 10_000 }).catch(() => {});
    await pause(page, 1500);
  });
  await s.step("accept the proposed level", async () => {
    const accept = page.getByRole("button", { name: /Accept urgent pathway|Accept proposed step/ }).first();
    await click(page, accept);
    await settle(page, 1200);
  });
  await s.step("request supervisor co-sign", async () => {
    const close = panel(page, /^Close case$/);
    await close.scrollIntoViewIfNeeded();
    await click(page, page.getByRole("radio", { name: /Person declined further support/ }));
    await pause(page, 700);
    await click(page, page.getByRole("button", { name: /Request supervisor co-sign/ }));
    await page.getByText(/Co-sign requested|co-sign requested/).first().waitFor({ timeout: 30_000 });
    await pause(page, 1800);
  });
  await s.step("refer to a service", async () => {
    await goto(page, `/staff/case/${sid}`, 600);
    const refer = page.getByRole("button", { name: /Refer to this service/ }).first();
    await refer.scrollIntoViewIfNeeded();
    await pause(page, 1000);
    await click(page, refer);
    await page.getByRole("button", { name: /Mark booked/ }).waitFor({ timeout: 60_000 });
    await settle(page, 1000);
  });
  await s.step("mark the hand-off booked", async () => {
    const date = page.getByLabel(/Appointment date/);
    await click(page, date);
    const inAWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    await date.fill(inAWeek);
    await pause(page, 600);
    await click(page, page.getByRole("button", { name: /Mark booked/ }));
    await page.getByText(/Marked booked/).waitFor({ timeout: 30_000 });
    await pause(page, 2500);
  });
  await s.step("scroll the hand-off status", async () => {
    await scroll(page, -200);
    await pause(page, 1500);
  });

  // Keep the staff sign-in for clip 06 (git-ignored output folder).
  await context.storageState({ path: storagePath("staff") });
  s.save();
  return finishClip(context, page, "05-clinician");
}
