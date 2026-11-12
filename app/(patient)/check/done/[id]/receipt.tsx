"use client";

import { RESULT_KEY, SUBMITTED_AT_KEY, useStoredValue } from "@/lib/check/local-answers";
import { nextWorkingDay } from "@/lib/rules/tiers";

function readFollowUp(raw: string | null): boolean {
  try {
    return raw ? JSON.parse(raw).followUp === true : false;
  } catch {
    return false;
  }
}

const fmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function Receipt() {
  const raw = useStoredValue(SUBMITTED_AT_KEY);
  const sent = raw ? new Date(raw) : null;
  const replyBy = sent ? nextWorkingDay(sent) : null;
  const followUp = readFollowUp(useStoredValue(RESULT_KEY));

  return (
    <>
      <div className="flex flex-col gap-1.5 px-5 pt-5">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          Thank you. Your check-in is <em className="text-primary">in.</em>
        </h1>
        <p className="min-h-6 text-caption text-muted">{sent ? `Sent ${fmt.format(sent)}` : ""}</p>
      </div>

      <ol className="flex flex-1 flex-col px-5 pt-5">
        <Step state="done" title="Check-in sent" body="Your answers are saved and private." />
        <li className="flex gap-3.5">
          <Rail state="now" />
          <div className="flex-1 pb-[18px]">
            <div className="rounded-2xl bg-sage px-4 py-3.5">
              <span className="text-caption font-semibold text-primary-dark">Now</span>
              <p className="mt-0.5 font-semibold">A clinician is reviewing your answers</p>
              <p className="mt-1 text-caption text-text-on-sage">
                You&apos;ll hear from us by <strong>{replyBy ? fmt.format(replyBy) : "the next working day"}</strong>.
              </p>
            </div>
          </div>
        </li>
        <Step
          state="next"
          title="Your next step"
          body="A clinician will contact you about what happens next."
          last={!followUp}
        />
        {/* Only if the person chose a follow-up on the result page. */}
        {followUp && <Step state="next" title="Follow-up check-in" body="In about 4 weeks. We'll remind you." last />}
      </ol>
    </>
  );
}

function Rail({ state, last }: { state: "done" | "now" | "next"; last?: boolean }) {
  return (
    <div className="flex flex-col items-center" aria-hidden="true">
      {state === "done" && (
        <div className="flex size-7 items-center justify-center rounded-full bg-primary">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      {state === "now" && (
        <div className="flex size-7 items-center justify-center rounded-full border-[3px] border-primary bg-surface">
          <div className="size-2.5 rounded-full bg-primary" />
        </div>
      )}
      {state === "next" && <div className="size-7 rounded-full border-2 border-step-idle bg-surface" />}
      {!last && <div className={`min-h-6 w-0.5 flex-1 ${state === "done" ? "bg-primary" : "bg-line"}`} />}
    </div>
  );
}

function Step({
  state,
  title,
  body,
  last,
}: {
  state: "done" | "next";
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <li className="flex gap-3.5">
      <Rail state={state} last={last} />
      <div className={last ? "" : "pb-[18px]"}>
        <strong className="font-semibold">{title}</strong>
        <p className="mt-0.5 text-caption text-muted">{body}</p>
      </div>
    </li>
  );
}
