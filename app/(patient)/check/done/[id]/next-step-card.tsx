"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { answerReferral } from "../../actions";
import type { ReferralCardView } from "@/lib/receipt/build";

const day = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${d}T12:00:00`));
const choice =
  "tap min-h-11 cursor-pointer rounded-full border-[1.5px] border-line bg-surface px-4 text-caption font-medium text-ink hover:border-primary disabled:cursor-wait";

/**
 * "Your next step": the service the clinician referred you to, how to book,
 * and one question at a time about how the hand-off is going. Answers go to
 * the care team; "I need help booking" puts the case back in their queue.
 */
export function NextStepCard({ referral }: { referral: ReferralCardView }) {
  const [answered, setAnswered] = useState<string | null>(null);
  const [asking, setAsking] = useState<"date" | null>(null);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const { service, card } = referral;

  const send = (payload: { answer: string; bookedFor?: string }, thanks: string) =>
    start(async () => {
      setError("");
      const r = await answerReferral(payload).catch(() => ({ ok: false as const }));
      if (!r.ok) return setError("That didn't save. Please try again.");
      setAsking(null);
      setAnswered(thanks);
    });

  return (
    <section aria-labelledby="next-step-h" className="anim-pop mx-5 mt-4 flex flex-col gap-3 rounded-[20px] bg-surface p-5 shadow-[0_8px_28px_rgba(31,42,28,0.08)]">
      <span id="next-step-h" className="text-[0.75rem] font-semibold tracking-[0.06em] text-primary-dark uppercase">
        Your next step
      </span>
      <div>
        <h2 className="font-serif text-[1.5rem] leading-tight font-medium">{service.name}</h2>
        <p className="text-caption text-muted">
          {service.kind} · {service.mode}
        </p>
      </div>
      <p className="text-caption text-text-2">{service.about}</p>
      <div className="rounded-2xl bg-sky px-4 py-3">
        <span className="text-[0.75rem] font-semibold tracking-[0.06em] text-blue uppercase">How to book</span>
        <p className="mt-0.5 text-blue-ink">{service.booking}</p>
      </div>

      {answered ? (
        <p role="status" className="rounded-xl bg-sage-mist px-3.5 py-2.5 text-caption">
          {answered}
        </p>
      ) : card.kind === "ask_booked" ? (
        <div className="flex flex-col gap-2">
          {card.reminder && (
            <p className="text-caption text-text-2">A reminder: booking soon helps you get support sooner.</p>
          )}
          <p className="font-semibold">Have you booked?</p>
          {asking === "date" ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-caption text-text-2">
                Appointment date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="min-h-11 rounded-xl border-[1.5px] border-line bg-surface px-3"
                />
              </label>
              <button
                type="button"
                disabled={!date || pending}
                onClick={() => send({ answer: "booked", bookedFor: date }, `Thank you. Your appointment is on ${day(date)}. We'll check in after it.`)}
                className="tap min-h-11 cursor-pointer rounded-full bg-primary px-5 text-caption font-semibold text-white disabled:cursor-default disabled:opacity-45"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => setAsking("date")} className={choice}>
                Yes
              </button>
              <button type="button" disabled={pending} onClick={() => send({ answer: "not_yet" }, "That's fine. We'll remind you here in a few days.")} className={choice}>
                Not yet
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => send({ answer: "help" }, "We've told your care team. Someone will help you book, usually within one working day.")}
                className={choice}
              >
                I need help booking
              </button>
            </div>
          )}
        </div>
      ) : card.kind === "help_requested" ? (
        <p className="rounded-xl bg-sage-mist px-3.5 py-2.5 text-caption">
          Your care team knows you&apos;d like help booking. Someone will get in touch, usually within one working day.
        </p>
      ) : card.kind === "booked" ? (
        <p className="rounded-xl bg-sage-mist px-3.5 py-2.5 text-caption">
          {card.bookedFor ? `Booked for ${day(card.bookedFor)}.` : "Booked."} We&apos;ll check in after your appointment.
        </p>
      ) : card.kind === "ask_attended" ? (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Did you see them{card.bookedFor ? ` on ${day(card.bookedFor)}` : ""}?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => send({ answer: "attended" }, "Thank you. We've noted your first appointment.")} className={choice}>
              Yes
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => send({ answer: "not_attended" }, "Thanks for telling us. Your care team will be in touch to help.")}
              className={choice}
            >
              Not yet
            </button>
          </div>
        </div>
      ) : null}

      {error && (
        <p role="status" className="text-caption text-danger">
          {error}
        </p>
      )}
      <Link href="/support-options" className="inline-flex min-h-10 items-center self-start text-caption">
        About your support options
      </Link>
    </section>
  );
}
