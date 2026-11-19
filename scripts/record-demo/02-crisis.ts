// Clip 02: quick check → "Yes" to the safety question → crisis screen, held 3 s. Desktop, about 20 s.
import type { Browser } from "playwright";
import { DESKTOP, click, finishClip, goto, newClip, pause, scroll, sessionIdOf, settle, startQuickCheck, answerQuickCheck, stepper, writeState } from "./lib";

export default async function clip02(browser: Browser) {
  const s = stepper("02-crisis");
  const { context, page } = await newClip(browser, DESKTOP);

  await s.step("start", () => goto(page, "/start"));
  await s.step("choose Quick check", () => click(page, page.getByRole("link", { name: /Quick check/ })));
  await s.step("consent", () => startQuickCheck(page, 700));
  await s.step("answer, then Yes to the safety question", () =>
    answerQuickCheck(page, ["More than half the days", "Nearly every day", "More than half the days", "Several days", "Yes"], 800),
  );
  await s.step("crisis screen, held 3 s", async () => {
    await page.waitForURL(/\/help-now|\/check\/quick\/(health|result)/, { timeout: 60_000 });
    await settle(page, 3000);
    await scroll(page, 240);
    await pause(page, 1200);
    await scroll(page, -240);
    await pause(page, 800);
  });

  const sid = await sessionIdOf(context);
  writeState((st) => {
    if (sid) st.sessions["02"] = sid;
  });
  s.save();
  return finishClip(context, page, "02-crisis");
}
