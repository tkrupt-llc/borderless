import Link from "next/link";
import { HillsBanner } from "@/components/hills";
import { PatientHeader } from "@/components/patient-header";
import { DiscreetToggle } from "@/components/discreet-toggle";
import en from "@/content/i18n/en.json";

const card = "flex min-h-11 items-center gap-3.5 rounded-[18px] px-[18px] py-4 no-underline";

export default function StartPage() {
  return (
    <>
      <PatientHeader />
      <HillsBanner />

      <div className="flex flex-col gap-3.5 px-5 pt-6">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          Hi. How would you like to <em className="text-primary">start?</em>
        </h1>
        <p className="mb-1 text-text-2">A clinician reads every check-in. You can stop at any time.</p>

        <Link href="/help-now" className={`${card} border-[1.5px] border-ink bg-surface text-ink`}>
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
            <path
              d="M14 24s-9-5.5-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12z"
              fill="none"
              stroke="var(--ink)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          <span className="flex flex-col">
            <strong className="font-semibold">I&apos;m not safe right now</strong>
            <span className="text-caption text-muted">Emergency help first</span>
          </span>
        </Link>

        <Link href="/check/quick/consent" className={`${card} bg-sage text-ink hover:text-ink`}>
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
            <circle cx="14" cy="14" r="10" fill="none" stroke="var(--ink)" strokeWidth="2" />
            <path d="M14 8v6l4 3" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="flex flex-col">
            <strong className="font-semibold">Quick check</strong>
            <span className="text-caption text-text-on-sage">5 questions · about 2 minutes</span>
          </span>
        </Link>

        <Link href="/check/full/consent" className={`${card} bg-primary text-white hover:text-white`}>
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
            <rect x="6" y="4" width="16" height="20" rx="3" fill="none" stroke="#FFFFFF" strokeWidth="2" />
            <path d="M10 10h8M10 14h8M10 18h5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="flex flex-col">
            <strong className="font-semibold">Full check-in</strong>
            <span className="text-caption text-on-dark">About 10 minutes · fullest picture</span>
          </span>
        </Link>
      </div>

      {/* Trust signals (spec): reviewing psychiatrist, licensed partner, "not a therapist", data promise. */}
      <div className="flex flex-col gap-3 px-5 pt-8">
        <p className="font-serif text-[1.375rem] leading-snug">{en.start.notATherapist}</p>
        {/* Research rule 6: say clearly that it is an AI, at the start. */}
        <p className="text-caption text-text-2">{en.trust.aiNotice}</p>
        <p className="text-caption text-text-2">
          {en.trust.reviewedBy}. {en.trust.partner}.
        </p>
        <section aria-labelledby="data-promise" className="rounded-2xl bg-sage-soft px-4 py-3.5">
          <h2 id="data-promise" className="font-semibold">
            {en.trust.dataPromiseTitle}
          </h2>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 ps-5 text-caption text-text-2">
            {en.trust.dataPromise.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <DiscreetToggle />
      </div>
    </>
  );
}
