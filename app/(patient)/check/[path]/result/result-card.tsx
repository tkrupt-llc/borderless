"use client";

import Link from "next/link";
import { RESULT_KEY, useStoredValue } from "@/lib/check/local-answers";
import { ChevronRight } from "@/components/icons";
import wording from "@/content/result-wording.json";
import { LaterChoices } from "./later-choices";
import { MyTrend } from "./my-trend";
import { SafetyDone } from "./safety-done";
import { caseRef } from "@/lib/case-ref";

type StoredResult = {
  path: string;
  sessionId: string | null;
  sentToClinician: boolean;
  scores: { instrument: string; total: number; band: string; positive?: boolean }[];
};

type InstrumentWording = { label: string; maxScore: number; bands: Record<string, string> };
const instruments = wording.instruments as Record<string, InstrumentWording>;

function parse(raw: string | null): StoredResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredResult;
  } catch {
    return null;
  }
}

// Plain words only: a band sentence, never a number on its own and never a diagnosis.
export function ResultCard() {
  const result = parse(useStoredValue(RESULT_KEY));

  if (!result) {
    return (
      <div className="flex flex-col gap-3 px-5 pt-6">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">No results to show</h1>
        <p className="text-text-2">Results are kept only in this browser tab, and only until you close it.</p>
        <Link href="/start">Start a check-in</Link>
      </div>
    );
  }

  if (result.path === "safety") {
    return <SafetyDone positive={result.scores.some((s) => s.instrument === "ASQ" && s.band !== "negative")} />;
  }

  const shown = result.scores.filter((s) => instruments[s.instrument]?.bands[s.band]);
  const anyGatePositive = result.path === "quick" && result.scores.some((s) => s.positive);
  // Questionnaires on this path with no score (a "Prefer not to say" means no total, never a guess).
  const expected: Record<string, string[]> = { quick: ["PHQ2", "GAD2"], full: ["PHQ9", "GAD7"], followup: ["PHQ9", "GAD7"] };
  const missing = [...new Set((expected[result.path] ?? []).filter((i) => !result.scores.some((s) => s.instrument === i)).map((i) => instruments[i]?.label ?? i))];

  return (
    <div className="flex flex-col gap-4 px-5 pt-5">
      <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
        {result.path === "followup" ? "Your follow-up " : "What your answers "}
        <em className="text-primary">{result.path === "followup" ? "results" : "show"}</em>
      </h1>

      <ul className="flex flex-col gap-2.5">
        {shown.map((s) => {
          const w = instruments[s.instrument];
          return (
            <li key={s.instrument} className="rounded-2xl bg-sage px-4 py-3.5">
              <span className="text-caption font-semibold text-primary-dark">{w.label}</span>
              <p className="mt-0.5 text-text-on-sage">{w.bands[s.band]}</p>
              {/* Research: severity in words first, the score second. */}
              <p className="mt-1 text-small text-text-on-sage">
                Score: {s.total} out of {w.maxScore} · screening score, not a diagnosis
              </p>
            </li>
          );
        })}
      </ul>

      {missing.length > 0 && (
        <p className="rounded-2xl bg-surface px-4 py-3 text-caption text-text-2">
          No {missing.join(" or ").toLowerCase()} score this time, because a question was left as &ldquo;Prefer not to say&rdquo;.
          Your clinician still sees your other answers.
        </p>
      )}

      <section aria-labelledby="not-mean" className="rounded-2xl border-[1.5px] border-line bg-surface px-4 py-3.5">
        <h2 id="not-mean" className="font-semibold">
          What this does not mean
        </h2>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 ps-5 text-caption text-text-2">
          {wording.doesNotMean.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="next-h" className="rounded-2xl bg-sky px-4 py-3.5">
        <h2 id="next-h" className="font-semibold text-blue-ink">
          What happens next
        </h2>
        {result.sentToClinician ? (
          <ol className="mt-1.5 flex list-decimal flex-col gap-1 ps-5 text-caption text-blue-ink">
            <li>
              Your answers have been sent{result.sessionId ? ` (reference ${caseRef(result.sessionId)})` : ""}. A clinician reads
              them, usually within one working day, and sooner if anything sounds urgent.
            </li>
            <li>They choose your next step with you, from self-help to specialist care.</li>
            <li>You&apos;ll see each step on your timeline: reviewed, referred, booked and first contact.</li>
          </ol>
        ) : (
          <p className="mt-1.5 text-caption text-blue-ink">Your answers stayed with you. No one will contact you about them.</p>
        )}
        <Link href="/support-options" className="mt-2 inline-flex min-h-11 items-center text-caption font-semibold text-blue">
          See your support options →
        </Link>
      </section>

      {/* A follow-up already carries the earlier choices; it shows the trend instead. */}
      {result.path === "followup" ? <MyTrend /> : <LaterChoices path={result.path} />}

      <div className="flex flex-col gap-2.5 pb-2">
        {result.sentToClinician && (
          <Link
            href={`/check/done/${result.sessionId ?? "local"}`}
            className="flex min-h-12 items-center justify-center rounded-full bg-primary px-6 font-medium text-white no-underline hover:text-white"
          >
            See your timeline
          </Link>
        )}
        {anyGatePositive && (
          <Link
            href="/check/full/consent"
            className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3.5 text-ink no-underline hover:text-ink"
          >
            <span className="flex flex-col">
              <strong className="text-base font-semibold">Full check-in</strong>
              <span className="text-small text-muted">{wording.fullCheckInOffer}</span>
            </span>
            <ChevronRight />
          </Link>
        )}
        <Link
          href="/coping"
          className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3.5 text-ink no-underline hover:text-ink"
        >
          <span className="flex flex-col">
            <strong className="text-base font-semibold">Try a coping card</strong>
            <span className="text-small text-muted">Short exercises you can use any time</span>
          </span>
          <ChevronRight />
        </Link>
      </div>
    </div>
  );
}
