import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake cookie jar and session store, so the banner's server actions run without a browser or database.
const cookie: { sid: string | null } = { sid: null };
const sessions = new Set<string>();

vi.mock("@/lib/db/server", () => ({ isDbConfigured: () => true, db: () => ({}) }));
vi.mock("@/lib/db/patient-session", () => ({
  readSessionId: async () => cookie.sid,
  clearSessionId: async () => {
    cookie.sid = null;
  },
}));
vi.mock("@/lib/check/persist", () => ({
  getSession: async (id: string) => (sessions.has(id) ? { id, path: "quick", taken_over: false } : null),
}));

const { notMe, returningVisitor } = await import("@/app/returning-actions");
const { RETURNING_BANNER } = await import("@/lib/returning/banner");
const { HEALTH_WORDS } = await import("@/lib/contact/messages");

const SID = "11111111-2222-4333-8444-555555555555";

describe("landing banner for returning visitors", () => {
  beforeEach(() => {
    cookie.sid = null;
    sessions.clear();
  });

  it("is shown when the browser holds a valid patient cookie", async () => {
    sessions.add(SID);
    cookie.sid = SID;
    expect(await returningVisitor()).toEqual({ show: true });
  });

  it("is hidden without a cookie", async () => {
    expect(await returningVisitor()).toEqual({ show: false });
  });

  it("is hidden when the cookie points at a check-in that no longer exists", async () => {
    cookie.sid = SID;
    expect(await returningVisitor()).toEqual({ show: false });
  });

  it("'Not me' clears the cookie, so the banner goes away", async () => {
    sessions.add(SID);
    cookie.sid = SID;
    expect(await returningVisitor()).toEqual({ show: true });
    expect(await notMe()).toEqual({ ok: true });
    expect(cookie.sid).toBeNull();
    expect(await returningVisitor()).toEqual({ show: false });
  });

  it("says nothing about health", () => {
    const text = Object.values(RETURNING_BANNER).join(" ").toLowerCase();
    for (const w of HEALTH_WORDS) expect(text).not.toContain(w);
  });
});
