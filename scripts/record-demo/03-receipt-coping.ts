// Clip 03: a finished check-in → receipt (timeline) with the reply-by time → TIP, STOP and paced breathing cards.
// The check-in itself is answered off camera (clip 01 already shows it); the clip opens on its result.
// Phone size, about 25 s.
import type { Browser } from "playwright";
import { writeFileSync } from "node:fs";
import { dumpSessionStorage, BASE_URL, PHONE, click, finishClip, goto, newClip, offCamera, pause, scroll, sessionIdOf, settle, startQuickCheck, answerQuickCheck, stepper, storagePath, writeState } from "./lib";

export default async function clip03(browser: Browser) {
  const s = stepper("03-receipt-coping");

  // Off camera: finish a quick check, keep the browser state (cookie + stored result with the return code).
  const setup = await offCamera(browser, PHONE);
  await setup.page.goto(BASE_URL + "/check/quick/consent");
  await startQuickCheck(setup.page, 300);
  await answerQuickCheck(setup.page, ["Several days", "Several days", "Not at all", "Several days", "No"], 300);
  await setup.page.waitForURL(/\/health/);
  await setup.page.getByRole("link", { name: "Skip", exact: true }).click();
  await setup.page.waitForURL(/\/contact/);
  await setup.page.getByRole("link", { name: "Not now" }).click();
  await setup.page.waitForURL(/\/result/);
  await settle(setup.page, 500);
  const sid = await sessionIdOf(setup.context);
  const resultUrl = setup.page.url();
  const tabStorage = await dumpSessionStorage(setup.page);
  writeFileSync(storagePath("03-tab"), JSON.stringify(tabStorage));
  await setup.context.storageState({ path: storagePath("03") });
  await setup.context.close();
  writeState((st) => {
    if (sid) st.sessions["03"] = sid;
  });

  const { context, page } = await newClip(browser, PHONE, { storageState: storagePath("03"), sessionStorage: tabStorage });
  await s.step("result", () => goto(page, new URL(resultUrl).pathname, 1200));
  await s.step("See your timeline", () => click(page, page.getByRole("link", { name: "See your timeline" })));
  await s.step("receipt with the reply-by time", async () => {
    await page.waitForURL(/\/check\/done\//);
    await settle(page, 1500);
    await scroll(page, 300);
    await pause(page, 1500);
  });
  for (const card of [
    { id: "tip", name: /TIP/ },
    { id: "stop", name: /STOP/ },
    { id: "breathing", name: /breathing/i },
  ]) {
    await s.step(`coping card: ${card.id}`, async () => {
      await goto(page, "/coping", 700);
      const link = page.locator(`a[href="/coping/${card.id}"]:visible`).first();
      if (await link.count()) await click(page, link);
      else await click(page, page.getByRole("link", { name: card.name }).first());
      await page.waitForURL(new RegExp(`/coping/${card.id}`));
      await settle(page, 1500);
      await scroll(page, 260);
      await pause(page, card.id === "breathing" ? 3000 : 1300);
    });
  }

  s.save();
  return finishClip(context, page, "03-receipt-coping");
}
