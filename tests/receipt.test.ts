import { describe, expect, it } from "vitest";
import { buildReceipt, type ReceiptInput } from "@/lib/receipt/build";

const at = (h: number) => `2026-11-16T${String(h).padStart(2, "0")}:00:00.000Z`;
const ev = (status: string, h: number, reason: string | null = null) => ({ status, reason, createdAt: at(h) });
const build = (events: ReceiptInput["events"], extra: Partial<ReceiptInput> = {}) =>
  buildReceipt({ events, proposal: { step: 1, urgent: false }, decision: null, followUp: false, ...extra })!;
const states = (v: ReturnType<typeof build>) => Object.fromEntries(v.steps.map((s) => [s.key, s.state]));

describe("patient receipt timeline", () => {
  it("shows nothing without a received event (no clinician review)", () => {
    expect(buildReceipt({ events: [], proposal: null, decision: null, followUp: false })).toBeNull();
  });

  it("just sent: review is the current step, with a reply-by time", () => {
    const v = build([ev("received", 9)]);
    expect(states(v)).toEqual({ received: "done", reviewed: "now", outcome: "next", booked: "next", contact: "next" });
    expect(v.steps[1].body).toMatch(/^You'll hear from us by /);
  });

  it("accepted: names the agreed step and moves on to booking", () => {
    const v = build([ev("received", 9), ev("reviewed", 10), ev("accepted", 10)], { decision: { action: "accept", newStep: null } });
    expect(states(v)).toMatchObject({ reviewed: "done", outcome: "done", booked: "now" });
    expect(v.steps[2].body).toBe("Your clinician agreed the next step: community or counsellor.");
  });

  it("re-routed: shows the new step and the clinician's reason", () => {
    const v = build([ev("received", 9), ev("reviewed", 10), ev("re_routed", 10, "Has a physical health condition.")], {
      decision: { action: "override", newStep: 2 },
    });
    expect(v.steps[2].body).toBe("Your clinician chose a different next step: primary care. Reason: Has a physical health condition.");
  });

  it("a missed call is said plainly, and a later conversation completes the step", () => {
    const tried = build([ev("received", 9), ev("contact_attempted", 11)]);
    expect(tried.steps.find((s) => s.key === "contact")?.body).toMatch(/^We tried to call you .* We'll try again\.$/);
    const spoke = build([ev("received", 9), ev("contact_attempted", 11), ev("spoke", 12)]);
    expect(states(spoke).contact).toBe("done");
    expect(spoke.steps.find((s) => s.key === "contact")?.title).toBe("We spoke with you");
  });

  it("booked and first contact confirmed: everything is done", () => {
    const v = build([ev("received", 9), ev("reviewed", 10), ev("accepted", 10), ev("booked", 11), ev("first_contact_confirmed", 12)]);
    expect(Object.values(states(v)).every((s) => s === "done")).toBe(true);
  });

  it("adds the follow-up step only when the person chose it, and never as the current step", () => {
    expect(build([ev("received", 9)]).steps.some((s) => s.key === "follow_up")).toBe(false);
    const v = build([ev("received", 9), ev("reviewed", 10), ev("accepted", 10), ev("booked", 11), ev("spoke", 12)], { followUp: true });
    expect(states(v).follow_up).toBe("next");
  });

  it("an accepted urgent pathway is described as urgent support", () => {
    const v = build([ev("received", 9), ev("accepted", 10)], { proposal: { step: null, urgent: true }, decision: { action: "accept", newStep: null } });
    expect(v.steps[2].body).toBe("Your clinician agreed the next step: urgent support.");
  });
});
