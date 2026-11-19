import { describe, expect, it } from "vitest";
import { discreetMessage, healthWordsIn, newCodeMessage, outsideSafeTimes, type Channel, type MessageKind } from "@/lib/contact/messages";
import { reminderTaskFor } from "@/lib/referral/followup";
import { canCloseCase, type ClosureState } from "@/lib/staff/safety-rules";

const KINDS: MessageKind[] = ["reply", "followup", "reminder_booking", "reminder_attended", "closing"];
const CHANNELS: Channel[] = ["sms", "whatsapp", "email", "phone", "in_person"];

// --- 1. Discreet messages -------------------------------------------------------------

describe("1. Copy discreet message", () => {
  it("never contains a health word or the service's name, on any channel", () => {
    for (const kind of KINDS) {
      for (const ch of CHANNELS) {
        const text = discreetMessage(kind, ch, "BL-AB12CD", "https://example.org/return");
        expect(healthWordsIn(text), `${kind} / ${ch}: ${text}`).toEqual([]);
      }
    }
    expect(healthWordsIn(newCodeMessage("sms", "BL-AB12CD", "https://example.org/return", "K7QM-3XRA"))).toEqual([]);
  });

  it("carries the reference and the link", () => {
    const text = discreetMessage("reply", "sms", "BL-AB12CD", "https://example.org/return");
    expect(text).toContain("BL-AB12CD");
    expect(text).toContain("https://example.org/return");
  });

  it("is written for the channel: email gets a subject line", () => {
    expect(discreetMessage("reply", "email", "BL-AB12CD", "https://x/return")).toMatch(/^Subject: /);
    expect(discreetMessage("reply", "sms", "BL-AB12CD", "https://x/return")).toMatch(/^Hello, this is your care team\./);
  });

  it("the healthWordsIn check catches health words", () => {
    expect(healthWordsIn("About your mental health check-in")).toEqual(expect.arrayContaining(["mental", "health", "check-in"]));
  });
});

// --- 3. Reminder tasks ------------------------------------------------------------------

describe("3. Hand-off reminders become 'Send reminder' tasks", () => {
  it("the 3-day reminder asks staff to send a booking reminder", () => {
    expect(reminderTaskFor("remind")).toBe("reminder_booking");
  });
  it("'Did you see them?' asks staff to send an attendance question", () => {
    expect(reminderTaskFor("ask_attendance")).toBe("reminder_attended");
  });
  it("stalls and urgent requeues go back to the queue instead, without a reminder task", () => {
    expect(reminderTaskFor("stall")).toBeNull();
    expect(reminderTaskFor("urgent_requeue")).toBeNull();
  });
  it("every reminder kind has a discreet message", () => {
    for (const kind of ["reminder_booking", "reminder_attended"] as const) {
      expect(healthWordsIn(discreetMessage(kind, "whatsapp", "BL-AB12CD", "https://x/return"))).toEqual([]);
    }
  });
});

// --- 4. Closing as unreachable, and co-sign after a crisis ------------------------------

describe("4. Closure: unreachable and declined", () => {
  const base: ClosureState = {
    summarySigned: true,
    steps: { level: true, contact: false, handoff: true },
    openSafetyFlags: 0,
    urgentHandoffStalled: false,
    hadCrisis: false,
    contactAttempts: [],
    closingMessageSent: false,
    bySupervisor: false,
  };
  const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n, 10)).toISOString();

  it("needs 3 logged attempts over at least 5 days, plus a closing message", () => {
    const r = canCloseCase(base, "unreachable", ["contact"]);
    expect(r.ok).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/3 logged attempts/);
    expect(r.blockers.join(" ")).toMatch(/closing message/);
  });

  it("3 attempts within 4 days is not enough", () => {
    const state = { ...base, contactAttempts: [day(0), day(2), day(4)], closingMessageSent: true };
    expect(canCloseCase(state, "unreachable", ["contact"]).ok).toBe(false);
  });

  it("3 attempts over 5 days plus a logged closing message closes", () => {
    const state = { ...base, contactAttempts: [day(0), day(3), day(5)], closingMessageSent: true };
    expect(canCloseCase(state, "unreachable", ["contact"])).toEqual({ ok: true, blockers: [] });
  });

  it("without the closing message, it stays blocked", () => {
    const state = { ...base, contactAttempts: [day(0), day(3), day(5)] };
    expect(canCloseCase(state, "unreachable", ["contact"]).blockers).toEqual(["Unreachable needs a closing message sent and logged"]);
  });

  it("a case that had a crisis needs the supervisor to close it as declined or unreachable", () => {
    const crisis = { ...base, hadCrisis: true, contactAttempts: [day(0), day(3), day(5)], closingMessageSent: true };
    expect(canCloseCase(crisis, "declined", ["contact"]).ok).toBe(false);
    expect(canCloseCase(crisis, "unreachable", ["contact"]).ok).toBe(false);
    expect(canCloseCase({ ...crisis, bySupervisor: true }, "declined", ["contact"]).ok).toBe(true);
    expect(canCloseCase({ ...crisis, bySupervisor: true }, "unreachable", ["contact"]).ok).toBe(true);
  });

  it("other reasons on a crisis case don't need the supervisor", () => {
    const crisis = { ...base, hadCrisis: true };
    expect(canCloseCase(crisis, "handed_off", ["contact"]).ok).toBe(true);
  });
});

// --- 5. Safe times -------------------------------------------------------------------------

describe("5. Safe times (warning only)", () => {
  // 2026-11-18 is a Wednesday. UAE time is UTC+4.
  const uae = (iso: string) => new Date(`${iso}+04:00`);
  it("warns outside the chosen windows", () => {
    expect(outsideSafeTimes(["weekday_evenings"], uae("2026-11-18T10:00:00"))).toBe(true);
    expect(outsideSafeTimes(["weekday_evenings"], uae("2026-11-18T18:30:00"))).toBe(false);
    expect(outsideSafeTimes(["weekday_mornings"], uae("2026-11-21T10:00:00"))).toBe(true); // Saturday
    expect(outsideSafeTimes(["weekends"], uae("2026-11-21T10:00:00"))).toBe(false);
  });
  it("never warns without a choice, or with 'any time'", () => {
    expect(outsideSafeTimes([], uae("2026-11-18T03:00:00"))).toBe(false);
    expect(outsideSafeTimes(null, uae("2026-11-18T03:00:00"))).toBe(false);
    expect(outsideSafeTimes(["any_time"], uae("2026-11-18T03:00:00"))).toBe(false);
  });
});
