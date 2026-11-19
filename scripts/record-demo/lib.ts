/**
 * Shared helpers for the demo-video recordings (scripts/record-demo).
 *
 * - One browser context per clip, each with its own recordVideo, so every clip is its own file.
 * - Human pacing: wait for the screen to settle, then pause on key screens; type with a delay;
 *   scroll in small steps; move the mouse to an element before clicking it.
 * - A visible cursor dot is injected (headless video has no cursor of its own).
 * - Dev overlays and the Vercel toolbar are hidden.
 * - A step that can't be found is skipped and logged, and the clip keeps recording.
 *
 * Staff credentials come only from the environment (DEMO_CLINICIAN_EMAIL / DEMO_CLINICIAN_PASSWORD
 * in .env.local, which is git-ignored). They are never logged.
 */
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const BASE_URL = (process.env.DEMO_BASE_URL ?? "https://borderless-puce.vercel.app").replace(/\/$/, "");
export const OUT = path.resolve(process.cwd(), "scripts/record-demo/output");
export const WEBM = path.join(OUT, "webm");
const STATE = path.join(OUT, "state.json");

// Playwright records video at the CSS viewport size and never upscales, so phone clips are recorded at
// 390x844 and upscaled 2x (lanczos) to 780x1688 when converting to MP4 (see run-all.ts).
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, video: { width: 390, height: 844 } };
export const PHONE_OUTPUT = { width: 780, height: 1688 };
export const DESKTOP = { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, video: { width: 1920, height: 1080 } };

// ---------- state passed between clips (session ids, the clip-03 browser state) ----------
export type State = { sessions: Record<string, string>; skipped: Record<string, string[]> };
export function readState(): State {
  try {
    return JSON.parse(readFileSync(STATE, "utf8")) as State;
  } catch {
    return { sessions: {}, skipped: {} };
  }
}
export function writeState(update: (s: State) => void) {
  const s = readState();
  update(s);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(STATE, JSON.stringify(s, null, 2));
}
export const storagePath = (name: string) => path.join(OUT, `${name}.storage.json`);

// ---------- browser and contexts ----------
const CURSOR_AND_CLEANUP = `
(() => {
  const style = document.createElement("style");
  style.textContent = \`
    vercel-live-feedback, #vercel-live-feedback, [data-vercel-toolbar], nextjs-portal, #__next-build-watcher,
    [data-nextjs-toast], [data-nextjs-dev-tools-button] { display: none !important; }
    #__demo_cursor { position: fixed; z-index: 2147483647; width: 18px; height: 18px; margin: -9px 0 0 -9px;
      border-radius: 50%; background: rgba(47, 93, 115, 0.55); border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,.35); pointer-events: none; left: -40px; top: -40px;
      transition: transform .12s ease; }
    #__demo_cursor.down { transform: scale(.7); }
  \`;
  const add = () => {
    document.head.appendChild(style);
    const dot = document.createElement("div");
    dot.id = "__demo_cursor";
    document.body.appendChild(dot);
    const last = window.__demoCursor;
    if (last) { dot.style.left = last.x + "px"; dot.style.top = last.y + "px"; }
    addEventListener("mousemove", (e) => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px";
      try { sessionStorage.setItem("__demoCursor", JSON.stringify({ x: e.clientX, y: e.clientY })); } catch {} }, true);
    addEventListener("mousedown", () => dot.classList.add("down"), true);
    addEventListener("mouseup", () => dot.classList.remove("down"), true);
  };
  try { window.__demoCursor = JSON.parse(sessionStorage.getItem("__demoCursor") || "null"); } catch {}
  if (document.body) add(); else addEventListener("DOMContentLoaded", add);
})();
`;

export async function launch(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function newClip(
  browser: Browser,
  kind: typeof PHONE | typeof DESKTOP,
  opts: { storageState?: string; sessionStorage?: Record<string, string> } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  mkdirSync(WEBM, { recursive: true });
  const context = await browser.newContext({
    viewport: kind.viewport,
    deviceScaleFactor: kind.deviceScaleFactor,
    recordVideo: { dir: WEBM, size: kind.video },
    storageState: opts.storageState,
    permissions: ["clipboard-read", "clipboard-write"],
    colorScheme: "light",
    isMobile: kind === PHONE,
    locale: "en-GB",
    timezoneId: "Asia/Dubai",
  });
  await context.addInitScript(CURSOR_AND_CLEANUP);
  if (opts.sessionStorage) await seedSessionStorage(context, opts.sessionStorage);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(90_000);
  return { context, page };
}

/** A context that is NOT recorded: for setup the viewer shouldn't sit through. */
export async function offCamera(browser: Browser, kind: typeof PHONE | typeof DESKTOP, storageState?: string) {
  const context = await browser.newContext({ viewport: kind.viewport, deviceScaleFactor: kind.deviceScaleFactor, storageState, locale: "en-GB", timezoneId: "Asia/Dubai" });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(90_000);
  return { context, page };
}

/** Read this tab's sessionStorage (the stored result and return code live there). */
export async function dumpSessionStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => Object.fromEntries(Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k) ?? ""])));
}

/** Seed sessionStorage once per tab (a marker stops it coming back after the clip clears storage). */
export async function seedSessionStorage(context: BrowserContext, items: Record<string, string>) {
  await context.addInitScript((data: Record<string, string>) => {
    try {
      if (sessionStorage.getItem("__seeded")) return;
      for (const [k, v] of Object.entries(data)) sessionStorage.setItem(k, v);
      sessionStorage.setItem("__seeded", "1");
    } catch {}
  }, items);
}

/** Close the clip and move its video to output/webm/<name>.webm. */
export async function finishClip(context: BrowserContext, page: Page, name: string): Promise<string> {
  const video = page.video();
  await context.close();
  const target = path.join(WEBM, `${name}.webm`);
  if (video) {
    const src = await video.path();
    if (existsSync(target)) renameSync(target, target + ".old");
    renameSync(src, target);
  }
  return target;
}

// ---------- pacing ----------
export const pause = (page: Page, ms = 1000) => page.waitForTimeout(ms);

/** Wait for the screen to settle (network quiet, fonts loaded), then hold it for a beat. */
export async function settle(page: Page, holdMs = 1000) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {}); // live pages poll, so never wait long
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await pause(page, holdMs);
}

export async function goto(page: Page, route: string, holdMs = 1000) {
  await page.goto(BASE_URL + route, { waitUntil: "domcontentloaded" });
  await settle(page, holdMs);
}

/** Move the mouse to the element like a person would, then return its centre. */
export async function moveTo(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error("element has no box");
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 24);
  await page.mouse.move(x, y, { steps: 18 });
  await pause(page, 250);
  return { x, y };
}

export async function click(page: Page, target: Locator) {
  await target.waitFor({ state: "visible" });
  await moveTo(page, target);
  await target.click();
}

export async function type(page: Page, target: Locator, text: string) {
  await click(page, target);
  await target.pressSequentially(text, { delay: 60 });
}

/** Scroll by `px` in small, smooth steps. */
export async function scroll(page: Page, px: number, stepPx = 60, stepMs = 45) {
  const steps = Math.max(1, Math.round(Math.abs(px) / stepPx));
  const box = page.viewportSize();
  if (box) await page.mouse.move(box.width / 2, box.height / 2, { steps: 6 });
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, Math.sign(px) * stepPx);
    await page.waitForTimeout(stepMs);
  }
}

/** Scroll smoothly from the current position to the bottom of the page over about `durationMs`. */
export async function scrollToBottom(page: Page, durationMs: number) {
  const remaining = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY);
  if (remaining <= 0) return;
  const stepMs = 40;
  const steps = Math.max(1, Math.round(durationMs / stepMs));
  await scroll(page, remaining, Math.max(4, remaining / steps), stepMs);
}

// ---------- skippable steps ----------
export function stepper(clip: string) {
  const skipped: string[] = [];
  return {
    skipped,
    /** Run a step; if it fails (missing element, timeout), log it, skip it and carry on. */
    async step(name: string, fn: () => Promise<unknown>) {
      try {
        await fn();
        console.log(`  ✓ ${name}`);
      } catch (e) {
        const why = (e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 140);
        skipped.push(`${name} (${why})`);
        console.log(`  – skipped: ${name} (${why})`);
      }
    },
    save() {
      writeState((s) => {
        s.skipped[clip] = skipped;
      });
    },
  };
}

export async function sessionIdOf(context: BrowserContext): Promise<string | undefined> {
  return (await context.cookies()).find((c) => c.name === "bl_sid")?.value;
}

/** Staff credentials from the environment only. Never logged. */
export function staffCredentials() {
  const email = process.env.DEMO_CLINICIAN_EMAIL;
  const password = process.env.DEMO_CLINICIAN_PASSWORD;
  if (!email || !password) throw new Error("Set DEMO_CLINICIAN_EMAIL and DEMO_CLINICIAN_PASSWORD in .env.local");
  if (/judge/i.test(email)) throw new Error("Use the demo clinician account, not the judge account");
  return { email, password };
}

/** Answer the quick check, one tap per page, waiting for each page to change. */
export async function answerQuickCheck(page: Page, answers: string[], holdMs = 1000) {
  for (const [i, answer] of answers.entries()) {
    await page.waitForURL(new RegExp(`/check/quick/${i + 1}$`));
    await settle(page, holdMs);
    await click(page, page.getByRole("radio", { name: answer, exact: true }));
  }
}

export async function startQuickCheck(page: Page, holdMs = 1000) {
  await page.waitForURL(/\/check\/quick\/consent/);
  await settle(page, holdMs);
  const box = page.getByRole("checkbox").first();
  if (!(await box.isChecked())) await click(page, box);
  await pause(page, 400);
  await click(page, page.getByRole("button", { name: /let's start/i }));
}
