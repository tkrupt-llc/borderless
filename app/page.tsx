import Link from "next/link";
import { Logo } from "@/components/logo";
import { HillsHero } from "@/components/hills";
import { BreathingIcon, GroundingIcon, TipIcon, WavesIcon } from "@/components/icons";
import en from "@/content/i18n/en.json";

const wrap = "mx-auto w-full max-w-[1120px] px-5 sm:px-8";
const h2 = "font-serif text-[2.25rem] leading-[1.15] font-normal sm:text-[2.75rem]";
const primaryBtn =
  "inline-flex min-h-12 items-center rounded-full bg-primary px-[26px] py-3.5 font-medium text-white no-underline hover:text-white";
const outlineBtn =
  "inline-flex min-h-12 items-center rounded-full border-[1.5px] border-ink px-[26px] py-3.5 font-medium text-ink no-underline";

export default function Landing() {
  return (
    <div className="text-[1.125rem] leading-[1.55]">
      <header className={`${wrap} flex flex-wrap items-center justify-between gap-4 py-5`}>
        <Link href="/" aria-label="borderless home" className="no-underline">
          <Logo size="lg" />
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-7 gap-y-2 text-base">
          <a href="#how" className="text-ink no-underline">How it works</a>
          <a href="#safe" className="text-ink no-underline">Why it&apos;s safe</a>
          <a href="#clinicians" className="text-ink no-underline">For clinicians</a>
          <Link
            href="/start"
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-[22px] py-3 font-medium text-white no-underline hover:text-white"
          >
            Start check-in
          </Link>
        </nav>
      </header>

      <main>
        <section className={`${wrap} pt-10 sm:pt-14`}>
          <div className="flex flex-wrap items-end justify-between gap-12">
            <div className="min-w-0 flex-[1_1_520px]">
              <p className="mb-4 flex items-center gap-2.5 text-caption font-semibold text-muted">
                <span className="size-2.5 rounded-full bg-clay" aria-hidden="true" />
                Mental wellbeing check-in
              </p>
              <h1 className="font-serif text-[2.75rem] leading-[1.05] font-normal tracking-[-0.01em] sm:text-[4rem]">
                Talk to someone <em className="text-primary">sooner.</em>
              </h1>
            </div>
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-6">
              <p className="text-lead text-text-2">
                A five-minute check-in, read by a real clinician who decides your next step. The assistant helps you
                answer; it never diagnoses you.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/start" className={primaryBtn}>Start check-in</Link>
                <Link href="/help-now" className={outlineBtn}>I need help now</Link>
              </div>
            </div>
          </div>
          <HillsHero />
        </section>

        <section id="how" className={`${wrap} pt-20 sm:pt-24`}>
          <h2 className={`${h2} mb-10`}>
            Three steps to <em className="text-primary">begin</em>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
            <div className="flex flex-col gap-3 rounded-3xl bg-surface p-7">
              <span className="text-caption font-semibold text-muted">[01]</span>
              <h3 className="font-serif text-[1.625rem] font-medium">Check in</h3>
              <p className="text-text-2">Answer short questions, one at a time. Stop and come back whenever you like.</p>
            </div>
            <div className="flex flex-col gap-3 rounded-3xl bg-sage p-7">
              <span className="text-caption font-semibold text-primary-dark">[02]</span>
              <h3 className="font-serif text-[1.625rem] font-medium">A clinician reviews</h3>
              <p className="text-text-on-sage">A real person reads your answers and chooses the right next step for you.</p>
            </div>
            <div className="flex flex-col gap-3 rounded-3xl bg-primary p-7 text-white">
              <span className="text-caption font-semibold text-[#E4EAD6]">[03]</span>
              <h3 className="font-serif text-[1.625rem] font-medium">We follow up</h3>
              <p className="text-on-dark">
                Short check-ins every few weeks, so you and your clinician can see how things change.
              </p>
            </div>
          </div>
        </section>

        <section className={`${wrap} pt-[72px]`}>
          <p className="mb-5 text-caption font-semibold text-muted">
            How quickly a person replies
          </p>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] border-t border-line">
            {[
              ["15 min", "If you may be in immediate danger"],
              ["4 hours", "If things are urgent"],
              ["1 day", "For everyone else (one working day)"],
            ].map(([value, label]) => (
              <div key={value} className="flex flex-col-reverse border-b border-line py-6 pr-6">
                <dt className="mt-2.5 text-base text-text-2">{label}</dt>
                <dd className="font-serif text-[3rem] leading-none text-primary-dark">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="safe" className={`${wrap} pt-20 sm:pt-24`}>
          <h2 className={`${h2} mb-10`}>
            Why it&apos;s <em className="text-primary">safe</em>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-10">
            <div className="flex flex-col gap-3.5">
              <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                <path d="M10 38c0-18 14-30 30-28s24 16 20 30-18 24-32 20S10 52 10 38z" fill="var(--sage)" />
                <circle cx="32" cy="28" r="9" fill="none" stroke="var(--ink)" strokeWidth="2" />
                <path d="M16 56c2-10 9-15 16-15s14 5 16 15" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
                <path d="M46 22l4 4 8-9" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="text-[1.3125rem] font-semibold">A clinician decides</h3>
              <p className="text-text-2">
                Your answers are scored with standard questionnaires. A clinician reviews every result. The assistant is
                labelled and never gives a diagnosis.
              </p>
            </div>
            <div className="flex flex-col gap-3.5">
              <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                <path d="M14 30c4-16 22-22 36-14s14 28 2 38-34 8-38-6-2-12 0-18z" fill="var(--sage)" />
                <rect x="22" y="32" width="28" height="22" rx="4" fill="none" stroke="var(--ink)" strokeWidth="2" />
                <path d="M28 32v-6a8 8 0 0 1 16 0v6" fill="none" stroke="var(--ink)" strokeWidth="2" />
                <circle cx="36" cy="43" r="2.5" fill="var(--ink)" />
              </svg>
              <h3 className="text-[1.3125rem] font-semibold">Private</h3>
              <p className="text-text-2">
                Only your care team sees your answers. Discreet mode shows a plain browser tab title, and Quick exit
                leaves the site in one tap.
              </p>
            </div>
            <div className="flex flex-col gap-3.5">
              <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                <path d="M12 36c0-16 16-26 30-22s20 18 14 30-22 18-32 12-12-12-12-20z" fill="var(--sage)" />
                <path
                  d="M24 22h24a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H36l-8 7v-7h-4a4 4 0 0 1-4-4V26a4 4 0 0 1 4-4z"
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path d="M36 28v6M36 38v.5" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
              <h3 className="text-[1.3125rem] font-semibold">Help is one tap away</h3>
              <p className="text-text-2">
                &ldquo;I need help now&rdquo; and &ldquo;Talk to a person&rdquo; stay at the bottom of every screen, at
                every step.
              </p>
            </div>
          </div>
        </section>

        <section className={`${wrap} pt-20 sm:pt-24`}>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className={h2}>
              While you <em className="text-primary">wait</em>
            </h2>
            <p className="max-w-[420px] text-body text-text-2">
              Short exercises you can use any time, chosen with a psychiatrist.
            </p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-5">
            {[
              { id: "breathing", Icon: BreathingIcon, title: "Paced breathing", time: "2 minutes" },
              { id: "urge-surfing", Icon: WavesIcon, title: "Urge surfing", time: "5 minutes" },
              { id: "grounding", Icon: GroundingIcon, title: "5-4-3-2-1 grounding", time: "3 minutes" },
              { id: "stop", Icon: TipIcon, title: "STOP", time: "1 minute" },
            ].map(({ id, Icon, title, time }) => (
              <Link
                key={id}
                href={`/coping/${id}`}
                className="flex flex-col gap-2.5 rounded-3xl bg-surface p-6 text-ink no-underline hover:text-ink"
              >
                <Icon />
                <h3 className="text-[1.1875rem] font-semibold">{title}</h3>
                <p className="text-base text-muted">{time}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="clinicians" className={`${wrap} pt-20 sm:pt-24`}>
          <div className="flex flex-wrap items-center justify-between gap-8 rounded-[28px] bg-sage-soft p-8 sm:p-12">
            <p className="min-w-0 flex-[1_1_520px] font-serif text-[1.625rem] leading-[1.3] sm:text-[2rem]">
              Feeling better is rarely a <em className="text-primary">straight line.</em> Missed check-ins and harder
              weeks are part of it.
            </p>
            <Link href="/start" className={primaryBtn}>Start check-in</Link>
          </div>
        </section>
      </main>

      <footer className="mt-24 bg-ink text-on-dark">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-6 py-10`}>
          <div className="min-w-0 flex-[1_1_520px]">
            <p className="text-[1.25rem] font-semibold">In danger right now?</p>
            <p className="mt-1.5 text-on-dark-2">{en.emergency.card}</p>
          </div>
          <Link
            href="/help-now"
            className="inline-flex min-h-12 items-center rounded-full bg-bg px-[26px] py-3.5 font-semibold text-ink no-underline"
          >
            I need help now
          </Link>
        </div>
      </footer>
    </div>
  );
}
