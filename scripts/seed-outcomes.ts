/**
 * Seeds SYNTHETIC simulated journeys for the service overview and the
 * employer/university views.
 *
 *   npm run seed:outcomes
 *
 * Every row is marked sessions.is_simulated = true, and re-running first
 * deletes only those simulated sessions (their records cascade). Real test
 * sessions are never touched. All tasks are created closed, so nothing lands
 * in the clinician queue. Deterministic (seeded random), so numbers repeat.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Small seeded random generator so every run produces the same data.
let seed = 20261118;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;

const AGES = ["18-24", "25-34", "35-44", "45-54", "55+"] as const;
const GENDERS = ["Female", "Male"] as const;
const NATIONALITIES = ["Emirati", "Arab expatriate", "South Asian", "Western", "Other"] as const;
const LANGUAGES = ["Arabic", "English", "Hindi/Urdu"] as const;
const EMIRATES = ["Abu Dhabi", "Abu Dhabi", "Abu Dhabi", "Al Ain", "Al Dhafra", "Dubai", "Sharjah"] as const;
const SERVICES = ["seha-primary-care", "pura-app", "sakina"];

const N = 160;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const H = 3_600_000;

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function main() {
  const removed = await must(db.from("sessions").delete({ count: "exact" }).eq("is_simulated", true).select("id"), "remove old simulated");
  console.log(`Removed ${removed?.length ?? 0} earlier simulated sessions.`);
  await must(db.from("adverse_events").delete().like("description", "SIMULATED:%"), "remove old simulated adverse events");

  const sessions: Record<string, unknown>[] = [];
  const plan: { idx: number; created: number; path: string; org: string | null; stats: boolean; severe: boolean; followUp: boolean; crisis: boolean }[] = [];
  for (let i = 0; i < N; i++) {
    const created = now - (2 + rand() * 80) * 24 * H;
    const crisis = chance(0.08);
    const path = crisis ? "crisis" : chance(0.55) ? "quick" : "full";
    // 34 from the example employer (shown), 6 from the example university (suppressed: under 10).
    const org = i < 34 ? "demo-employer" : i < 40 ? "demo-university" : chance(0.15) ? "demo-clinic" : null;
    plan.push({ idx: i, created, path, org, stats: chance(0.86), severe: chance(0.3), followUp: path !== "crisis" && chance(0.35), crisis });
    sessions.push({
      path,
      created_at: iso(created),
      is_simulated: true,
      clinic_id: org,
      demo_age_band: pick(AGES),
      demo_gender: pick(GENDERS),
      demo_nationality: pick(NATIONALITIES),
      demo_language_variety: pick(LANGUAGES),
      demo_emirate: pick(EMIRATES),
    });
  }
  const created = await must(db.from("sessions").insert(sessions).select("id"), "sessions");
  const ids = (created as { id: string }[]).map((r) => r.id);

  const consents: Record<string, unknown>[] = [];
  const receipt: Record<string, unknown>[] = [];
  const scores: Record<string, unknown>[] = [];
  const tasks: Record<string, unknown>[] = [];
  const referrals: Record<string, unknown>[] = [];
  const followUps: { parent: string; at: number; plan: (typeof plan)[number]; baseline: number }[] = [];

  plan.forEach((p, k) => {
    const id = ids[k];
    const at = (h: number) => iso(p.created + h * H);
    consents.push(
      { session_id: id, purpose: "clinician_review", granted: true, version: "simulated", created_at: at(0) },
      { session_id: id, purpose: "service_improvement", granted: p.stats, version: "simulated", created_at: at(0.2) },
    );
    const phq = p.severe ? 15 + Math.floor(rand() * 10) : 5 + Math.floor(rand() * 9);
    if (p.path === "full") scores.push({ session_id: id, instrument: "PHQ9", total: phq, band: phq >= 20 ? "severe" : phq >= 15 ? "moderately_severe" : phq >= 10 ? "moderate" : "mild", computed_by_rule: "simulated", created_at: at(0.2) });
    if (p.path === "quick") scores.push({ session_id: id, instrument: "PHQ2", total: Math.min(6, Math.round(phq / 4)), band: phq >= 12 ? "positive" : "negative", computed_by_rule: "simulated", created_at: at(0.1) });

    if (p.crisis) {
      const ackAfter = chance(0.9) ? 0.5 + rand() * 2.5 : 5 + rand() * 4; // most within the 4-hour clock
      tasks.push({ session_id: id, type: "red_flag", priority: "urgent", created_at: at(0), due_at: at(4), acknowledged_at: at(ackAfter), closed_at: at(ackAfter + 1) });
    } else {
      tasks.push({ session_id: id, type: "care_request", priority: "normal", created_at: at(0.2), due_at: at(24), acknowledged_at: at(3 + rand() * 20), closed_at: at(26) });
    }

    receipt.push({ session_id: id, status: "received", created_at: at(0.2) });
    receipt.push({ session_id: id, status: "reviewed", created_at: at(2 + rand() * 18) });
    if (chance(0.85)) {
      const spoke = 6 + rand() * (p.crisis ? 6 : 60);
      receipt.push({ session_id: id, status: "spoke", created_at: at(spoke) });
      if (chance(0.6)) {
        const refAt = spoke + 2 + rand() * 24;
        const service = pick(SERVICES);
        receipt.push({ session_id: id, status: "referred", service_id: service, created_at: at(refAt) });
        // Every simulated referral also gets a hand-off record, closed so the follow-up rules leave it alone.
        const ref: Record<string, unknown> = { session_id: id, service_id: service, urgent: p.crisis, referred_at: at(refAt), is_simulated: true, status: "closed", closed_at: at(refAt + 24 * 30) };
        if (chance(0.8)) {
          const bookAt = refAt + 24 * (1 + rand() * 9);
          receipt.push({ session_id: id, status: "booked", created_at: at(bookAt) });
          Object.assign(ref, { booked_at: at(bookAt), booked_for: at(bookAt + 24 * 3).slice(0, 10) });
          if (bookAt - refAt > 24 * 3) ref.reminder_at = at(refAt + 24 * 3);
          if (bookAt - refAt > 24 * 7) ref.stalled_at = at(refAt + 24 * 7);
          if (chance(0.82)) {
            const fc = bookAt + 24 * (1 + rand() * 6);
            receipt.push({ session_id: id, status: "first_contact_confirmed", created_at: at(fc) });
            ref.first_contact_at = at(fc);
          } else ref.stalled_at = ref.stalled_at ?? at(bookAt + 24 * 5);
        } else {
          Object.assign(ref, { reminder_at: at(refAt + 24 * 3), stalled_at: at(refAt + 24 * 7), help_requested_at: chance(0.4) ? at(refAt + 24 * 2) : null });
        }
        referrals.push(ref);
      }
    }
    if (p.followUp && p.path === "full") followUps.push({ parent: id, at: p.created + (FOLLOW + (chance(0.8) ? rand() * 5 : 8 + rand() * 10)) * 24 * H, plan: p, baseline: phq });
  });

  // Follow-ups only if they would already have happened.
  const due = followUps.filter((f) => f.at < now);
  if (due.length) {
    const fu = await must(
      db.from("sessions").insert(
        due.map((f) => ({
          path: "followup", parent_session_id: f.parent, created_at: iso(f.at), is_simulated: true, clinic_id: f.plan.org,
          demo_age_band: pick(AGES), demo_gender: pick(GENDERS), demo_nationality: pick(NATIONALITIES), demo_language_variety: pick(LANGUAGES), demo_emirate: pick(EMIRATES),
        })),
      ).select("id"),
      "follow-ups",
    );
    (fu as { id: string }[]).forEach((r, k) => {
      const f = due[k];
      const after = Math.max(0, f.baseline - Math.round(rand() * 12) + 2);
      consents.push({ session_id: r.id, purpose: "service_improvement", granted: f.plan.stats, version: "simulated", created_at: iso(f.at) });
      scores.push({ session_id: r.id, instrument: "PHQ9", total: after, band: after >= 15 ? "moderately_severe" : after >= 10 ? "moderate" : after >= 5 ? "mild" : "minimal", computed_by_rule: "simulated", created_at: iso(f.at) });
    });
  }

  await must(db.from("consent_records").insert(consents), "consents");
  await must(db.from("receipt_events").insert(receipt), "receipt");
  await must(db.from("scores").insert(scores), "scores");
  await must(db.from("tasks").insert(tasks), "tasks");
  await must(db.from("referrals").insert(referrals), "referrals");
  await must(
    db.from("adverse_events").insert([
      { session_id: ids[3], category: "care_delay", severity: "low", description: "SIMULATED: call-back made a day late.", created_at: iso(now - 20 * 24 * H) },
      { session_id: ids[11], category: "missed_urgent_contact", severity: "moderate", description: "SIMULATED: urgent alert acknowledged after the 4-hour clock.", created_at: iso(now - 9 * 24 * H) },
    ]),
    "adverse events",
  );
  console.log(`Seeded ${ids.length} simulated check-ins, ${due.length} follow-ups and ${referrals.length} hand-offs (synthetic).`);
}

const FOLLOW = 28;
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
