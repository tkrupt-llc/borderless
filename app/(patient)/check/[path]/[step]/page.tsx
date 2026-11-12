import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PatientHeader } from "@/components/patient-header";
import { PATHS, isPathId, stepsFor } from "@/lib/check/paths";
import { AnswerList } from "./answer-list";
import en from "@/content/i18n/en.json";

// One question per page. Every path/step pair is known at build time.
export function generateStaticParams() {
  return (Object.keys(PATHS) as (keyof typeof PATHS)[]).flatMap((path) =>
    stepsFor(path).map((_, i) => ({ path, step: String(i + 1) })),
  );
}

// The question reads the URL, so it sits behind Suspense. The fallback keeps
// Quick exit on screen instantly; the help bar comes from the layout.
export default function QuestionPage({ params }: PageProps<"/check/[path]/[step]">) {
  return (
    <Suspense fallback={<PatientHeader />}>
      <Question params={params} />
    </Suspense>
  );
}

async function Question({ params }: { params: PageProps<"/check/[path]/[step]">["params"] }) {
  const { path, step } = await params;
  if (!isPathId(path)) notFound();
  const steps = stepsFor(path);
  const index = Number(step) - 1;
  const current = steps[index];
  if (!Number.isInteger(index) || !current) notFound();

  const backHref = index === 0 ? "/start" : `/check/${path}/${index}`;
  const nextHref = index + 1 < steps.length ? `/check/${path}/${index + 2}` : null;
  const progress = Math.round(((index + 1) / steps.length) * 100);

  return (
    <>
      <PatientHeader backHref={backHref} />

      {/* Kept compact so all answers fit above the help bar on a small phone (research: no scrolling to answers). */}
      <div className="flex flex-col gap-1.5 px-5 pt-3">
        <div className="text-caption text-muted">
          {current.section} · {current.indexInSection} of {current.sectionSize}
        </div>
        <div
          role="progressbar"
          aria-label="Check-in progress"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 overflow-hidden rounded-full bg-track"
        >
          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-5 pt-5 sm:gap-3 sm:pt-8">
        {/* A gentle note before the suicide questions, so they never come as a surprise. */}
        {en.check.leadInItems.includes(current.item.id) && (
          <p className="rounded-2xl bg-sage-soft px-4 py-2.5 text-caption text-text-2">{en.check.leadIn}</p>
        )}
        {current.stem && <p className="text-caption text-muted">{current.stem}</p>}
        <h1
          id="question"
          className="font-serif text-[1.25rem] leading-snug font-normal min-[400px]:text-[1.375rem] sm:text-[1.75rem] sm:leading-tight"
        >
          {current.item.text.en}
        </h1>

        <AnswerList
          key={current.item.id}
          path={path}
          itemId={current.item.id}
          options={current.item.options.map((o) => ({ value: o.value, label: o.label.en }))}
          nextHref={nextHref}
        />

        <details className="text-caption">
          <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-primary-dark underline">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <circle cx="9" cy="9" r="7.5" fill="none" stroke="var(--primary-dark)" strokeWidth="1.6" />
              <path d="M9 8v4.5M9 5.5v.5" stroke="var(--primary-dark)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Why am I asked this?
          </summary>
          <p className="mt-1 rounded-2xl bg-sage-soft px-4 py-3 text-text-2">
            This is a standard question clinicians use. Your answers help a clinician choose the right next step for
            you. They are not a diagnosis.
          </p>
        </details>
      </div>
    </>
  );
}
