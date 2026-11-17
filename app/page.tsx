import Link from "next/link";
import { Logo } from "@/components/logo";
import { HillsHero } from "@/components/hills";
import { HeroChat } from "@/components/landing/hero-chat";
import { HowItWorks } from "@/components/landing/how-it-works";
import { TypedLine } from "@/components/landing/typed-line";
import { BreathingIcon, GroundingIcon, StopIcon, WavesIcon } from "@/components/icons";
import { CATEGORIES } from "@/lib/coping/categories";
import en from "@/content/i18n/en.json";

const wrap = "mx-auto w-full max-w-[1120px] px-5 sm:px-8";
const h2 = "font-serif text-[2.25rem] leading-[1.15] font-normal sm:text-[2.75rem]";
const primaryBtn =
  "tap inline-flex min-h-12 items-center rounded-full bg-primary px-[26px] py-3.5 font-medium text-white no-underline hover:text-white";
const outlineBtn =
  "tap inline-flex min-h-12 items-center rounded-full border-[1.5px] border-ink px-[26px] py-3.5 font-medium text-ink no-underline";

const PREVIEW = [
  { id: "breathing", Icon: BreathingIcon, title: "Paced breathing", time: "2 minutes", cat: CATEGORIES.calm },
  { id: "urge-surfing", Icon: WavesIcon, title: "Urge surfing", time: "5 minutes", cat: CATEGORIES.soothe },
  { id: "grounding", Icon: GroundingIcon, title: "Mindfulness", time: "3 minutes", cat: CATEGORIES.ground },
  { id: "stop", Icon: StopIcon, title: "STOP Skill", time: "1 minute", cat: CATEGORIES.clarity },
];

export default function Landing() {
  return (
    <div className="relative z-0 overflow-x-clip text-[1.125rem] leading-[1.55]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="drift absolute -top-[260px] -left-[200px] size-[620px] rounded-full bg-sky" />
        <div className="drift2 absolute top-[260px] -right-[220px] size-[520px] rounded-full bg-cat-distress" />
        <div className="drift2 absolute top-[2300px] -left-[240px] size-[480px] rounded-full bg-sky" />
        <div className="drift2 absolute top-[3600px] -right-[200px] size-[420px] rounded-full bg-cat-distress" />
      </div>
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
            className="tap inline-flex min-h-11 items-center rounded-full bg-primary px-[22px] py-3 font-medium text-white no-underline hover:text-white"
          >
            Start check-in
          </Link>
        </nav>
      </header>

      <main>
        <section className={`${wrap} pt-10 sm:pt-14`}>
          <div className="flex flex-wrap items-end justify-between gap-12">
            <div className="min-w-0 flex-[1_1_520px]">
              <p className="mb-4 flex items-center gap-2.5 text-caption font-semibold tracking-[0.08em] text-muted uppercase">
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
                <Link href="/demo" className="tap inline-flex min-h-12 items-center rounded-full px-3 py-3.5 font-medium text-primary-dark underline underline-offset-2">
                  See how it works
                </Link>
              </div>
              <p className="text-base text-text-2">
                Not ready for a check-in? <Link href="/talk" className="font-medium">Talk to a person</Link>: leave your
                number and the care team will call you.
              </p>
            </div>
          </div>
          <div className="relative mt-12">
            <HillsHero />
            <HeroChat />
          </div>
        </section>

        <section id="how" className={`${wrap} pt-20 sm:pt-24`}>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h2 className={h2}>
              How it <em className="text-primary">works</em>
            </h2>
            <p className="max-w-[420px] text-body text-text-2">
              Five steps, from your first answer to a follow-up that shows how things are changing.
            </p>
          </div>
          <HowItWorks />
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
            <p className="text-text-2">See a check-in and the clinician console side by side, with practice data.</p>
            <Link href="/demo" className={outlineBtn}>
              Try the live demo
            </Link>
          </div>
        </section>

        <section className={`reveal ${wrap} pt-[72px]`}>
          <p className="text-caption font-semibold tracking-[0.08em] text-muted uppercase">Reply-time targets</p>
          <p className="mt-1.5 mb-5 text-caption text-text-2">
            Each clinic sets its own times. The system flags any case that runs late to the duty supervisor.
          </p>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] border-t border-line">
            {(
              [
                [
                  "At once",
                  <>
                    If you may be in immediate danger, the on-call clinician is alerted straight away.{" "}
                    <strong className="text-ink">Don&apos;t wait: call 999 or 998.</strong>
                  </>,
                ],
                ["4 hours", "Target for urgent check-ins"],
                ["1 day", "Target for everyone else (one working day)"],
                ["7", "Coping cards approved by a psychiatrist"],
              ] as const
            ).map(([value, label]) => (
              <div key={value} className="flex flex-col-reverse border-b border-line py-6 pr-6">
                <dt className="mt-2.5 text-base text-text-2">{label}</dt>
                <dd className="font-serif text-[3rem] leading-none text-primary-dark">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="safe" className={`reveal ${wrap} pt-20 sm:pt-24`}>
          <h2 className={`${h2} mb-10`}>
            Why it&apos;s <em className="text-primary">safe</em>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-10">
            <div className="flex flex-col gap-3.5">
              <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                <path d="M10 38c0-18 14-30 30-28s24 16 20 30-18 24-32 20S10 52 10 38z" fill="var(--sky-deep)" />
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
                <path d="M14 30c4-16 22-22 36-14s14 28 2 38-34 8-38-6-2-12 0-18z" fill="var(--ai)" />
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
                <path d="M12 36c0-16 16-26 30-22s20 18 14 30-22 18-32 12-12-12-12-20z" fill="var(--cat-ground-deep)" />
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
                &ldquo;I need help now&rdquo; and &ldquo;Talk to a person&rdquo; stay on every screen, at every step.
              </p>
            </div>
          </div>
        </section>

        <section className={`reveal ${wrap} pt-20 sm:pt-24`}>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className={h2}>
              While you <em className="text-primary">wait</em>
            </h2>
            <p className="max-w-[420px] text-body text-text-2">
              Short exercises you can use any time, approved by a psychiatrist.
            </p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-5">
            {PREVIEW.map(({ id, Icon, title, time, cat }) => (
              <Link
                key={id}
                href={`/coping/${id}`}
                style={{ background: cat.bg }}
                className="tap flex flex-col gap-2.5 rounded-3xl p-6 text-ink no-underline hover:text-ink"
              >
                <Icon blob={cat.deep} />
                <span className="text-[0.75rem] font-semibold tracking-[0.04em] uppercase" style={{ color: cat.ink }}>
                  {cat.label}
                </span>
                <h3 className="text-[1.1875rem] font-semibold">{title}</h3>
                <p className="text-base text-muted">{time}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="clinicians" className={`reveal ${wrap} pt-20 sm:pt-24`}>
          <div className="flex flex-wrap items-center gap-10 rounded-[28px] bg-sky p-7 sm:p-12">
            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
              <p className="text-caption font-semibold tracking-[0.08em] text-[#34505b] uppercase">For clinicians</p>
              <h2 className="font-serif text-[2.25rem] leading-[1.15] font-normal sm:text-[2.5rem]">
                Everything you need, <em className="text-blue">on one card</em>
              </h2>
              {[
                ["A queue sorted by reply-by time.", "Imminent cases in red at the top; the rest as badges."],
                ["Scores and the rule that fired.", "No predicted diagnoses: you decide."],
                ["Missed a reply-by time?", "It goes to the duty supervisor automatically."],
              ].map(([title, body]) => (
                <div key={title} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[9px] size-2.5 shrink-0 rounded-full bg-blue" />
                  <p className="text-text-2">
                    <strong className="text-ink">{title}</strong> {body}
                  </p>
                </div>
              ))}
              <div className="flex flex-wrap gap-x-6">
                <Link href="/demo" className="inline-flex min-h-11 items-center font-semibold text-blue">
                  See the queue in the live demo →
                </Link>
                <Link href="/staff" className="inline-flex min-h-11 items-center font-semibold text-blue">
                  Care team sign-in →
                </Link>
              </div>
            </div>
            <div
              role="img"
              aria-label="Example clinician summary card"
              className="flex min-w-0 flex-[1_1_460px] flex-col rounded-[20px] bg-surface p-6 text-[0.9375rem] leading-snug"
            >
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3">
                <strong className="text-[1.0625rem]">BL-7C2E40 · Full check-in</strong>
                <span className="rounded-full bg-[#f4e3d3] px-2.5 py-1 text-[0.75rem] font-semibold text-[#6b3e1c]">Urgent · reply in 3 h 12 m</span>
              </div>
              {[
                ["In their words", "“I can't switch off at night and I've stopped seeing friends.”"],
                ["Scores", "PHQ-9 19 (moderately severe) · GAD-7 12 (moderate)"],
                ["Rule that fired", "PHQ-9 item 9 answered “several days” → urgent review"],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5 border-b border-track py-2.5">
                  <span className="text-[0.8125rem] text-muted">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
              <div className="mt-2 flex flex-col gap-0.5 rounded-xl bg-ai-soft px-3 py-2.5">
                <span className="text-[0.8125rem] text-ai-ink">AI-drafted note (check against answers)</span>
                <span>Sleep and low mood for about 6 weeks; work stress; lives with family.</span>
              </div>
            </div>
          </div>
        </section>

        <section className={`reveal ${wrap} pt-[72px]`}>
          <div className="flex flex-col items-center gap-6 border-t border-line pt-16 text-center">
            <TypedLine />
            <p className="max-w-[520px] text-text-2">Check in today and see when to expect a reply from a real person.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/start" className={primaryBtn}>Start check-in</Link>
              <Link href="/demo" className={outlineBtn}>See the live demo</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative mt-24 overflow-hidden rounded-t-[48px] bg-[linear-gradient(120deg,var(--cat-ground)_0%,var(--sky)_55%,var(--cat-distress)_100%)]">
        <div className={`${wrap} flex flex-col gap-10 pt-12`}>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-surface px-6 py-5">
            <div className="min-w-0 flex-[1_1_420px]">
              <p className="text-[1.25rem] font-semibold">In danger right now?</p>
              <p className="mt-1 text-text-2">{en.emergency.card}</p>
            </div>
            <Link
              href="/help-now"
              className="tap inline-flex min-h-12 items-center rounded-full bg-ink px-[26px] py-3.5 font-semibold text-white no-underline hover:text-white"
            >
              I need help now
            </Link>
          </div>
          <div className="flex flex-wrap justify-between gap-10">
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
              <Logo size="lg" />
              <p className="max-w-[340px] text-text-2">Earlier, safer mental wellbeing support. Every check-in is read by a clinician.</p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap gap-12 text-[0.9375rem]">
              <div className="flex flex-col gap-2">
                <strong>Get support</strong>
                <Link href="/start" className="text-ink no-underline hover:underline">Start check-in</Link>
                <Link href="/talk" className="text-ink no-underline hover:underline">Talk to a person</Link>
                <Link href="/coping" className="text-ink no-underline hover:underline">Coping cards</Link>
                <Link href="/home" className="text-ink no-underline hover:underline">Coming back?</Link>
                <Link href="/help-now" className="text-ink no-underline hover:underline">Help now</Link>
              </div>
              <div className="flex flex-col gap-2">
                <strong>For clinics</strong>
                <Link href="/staff" className="text-ink no-underline hover:underline">Clinician console</Link>
                <Link href="/demo" className="text-ink no-underline hover:underline">Live demo</Link>
                <a href="/embed-demo.html" className="text-ink no-underline hover:underline">Add to your website</a>
              </div>
              <div className="flex flex-col gap-2">
                <strong>Trust</strong>
                <a href="#safe" className="text-ink no-underline hover:underline">Safety and privacy</a>
                <Link href="/my-data" className="text-ink no-underline hover:underline">Your data</Link>
                <Link href="/guides" className="text-ink no-underline hover:underline">Self-help guides</Link>
              </div>
            </nav>
          </div>
        </div>
        <div className="foot-mark mt-8 -mb-[0.12em] text-center" aria-hidden="true">
          borderless
        </div>
      </footer>
    </div>
  );
}
