import Link from "next/link";
import { Logo } from "@/components/logo";
import { HillsHero } from "@/components/hills";
import { BreathingIcon, GroundingIcon, StopIcon, WavesIcon } from "@/components/icons";
import { CATEGORIES } from "@/lib/coping/categories";
import en from "@/content/i18n/en.json";

const wrap = "mx-auto w-full max-w-[1120px] px-5 sm:px-8";
const h2 = "font-serif text-[2.25rem] leading-[1.15] font-normal sm:text-[2.75rem]";
const primaryBtn =
  "tap inline-flex min-h-12 items-center rounded-full bg-primary px-[26px] py-3.5 font-medium text-white no-underline hover:text-white";
const outlineBtn =
  "tap inline-flex min-h-12 items-center rounded-full border-[1.5px] border-ink px-[26px] py-3.5 font-medium text-ink no-underline";

/** A small browser-window frame around each "How it works" illustration. */
function MiniScreen({ label, tint, children }: { label: string; tint: string; children: React.ReactNode }) {
  return (
    <div role="img" aria-label={label} className="min-w-0 flex-[1_1_440px] rounded-3xl p-5 sm:p-7" style={{ background: tint }}>
      <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_0_var(--line-warm)]">
        <div className="flex h-7 items-center gap-1.5 bg-[#f2efe8] px-3" aria-hidden="true">
          <span className="size-2 rounded-full bg-line" />
          <span className="size-2 rounded-full bg-line" />
          <span className="size-2 rounded-full bg-line" />
        </div>
        <div className="flex flex-col gap-2.5 p-5 text-[0.875rem] leading-snug" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

const STEPS: { title: string; body: string; screen: React.ReactNode; label: string; tint: string }[] = [
  {
    title: "Choose how to start",
    body: "Not safe right now, a quick 2-minute check, or a fuller check-in. Emergency help is always the first option.",
    label: "Start page with three options",
    tint: "var(--cat-ground)",
    screen: (
      <>
        <p className="font-serif text-[1.25rem]">
          Hi. How would you like to <em className="text-primary">start?</em>
        </p>
        <div className="rounded-xl border border-ink px-3.5 py-2.5">
          <strong>I&apos;m not safe right now</strong> · emergency help first
        </div>
        <div className="rounded-xl bg-sage px-3.5 py-2.5">
          <strong>Quick check</strong> · 5 questions
        </div>
        <div className="rounded-xl bg-primary px-3.5 py-2.5 font-medium text-white">
          <strong>Full check-in</strong> · about 10 minutes
        </div>
      </>
    ),
  },
  {
    title: "Answer one question at a time",
    body: "Standard questions, one per page, with a clear count for each section. Stop and come back whenever you like.",
    label: "Question page showing Mood 3 of 9",
    tint: "var(--sky)",
    screen: (
      <>
        <div className="flex justify-between text-[0.8125rem] text-muted">
          <span>Mood · 3 of 9</span>
          <span>Saved</span>
        </div>
        <div className="h-1.5 rounded-full bg-track">
          <div className="h-1.5 w-1/3 rounded-full bg-primary" />
        </div>
        <p className="mt-1 font-serif text-[1.125rem]">Trouble falling or staying asleep, or sleeping too much?</p>
        <div className="rounded-xl border border-line px-3.5 py-2.5">Not at all</div>
        <div className="rounded-xl bg-primary px-3.5 py-2.5 font-medium text-white">Several days</div>
        <div className="rounded-xl border border-line px-3.5 py-2.5">More than half the days</div>
      </>
    ),
  },
  {
    title: "A clinician reviews every check-in",
    body: "Answers are scored with fixed rules, never by AI. The most urgent check-ins rise to the top, each with a reply-by time.",
    label: "Clinician review queue with urgency badges",
    tint: "#dce8ec",
    screen: (
      <>
        <div className="flex items-center justify-between">
          <strong className="text-[0.9375rem] text-blue">Review queue</strong>
          <span className="text-[0.8125rem] text-muted">Sorted by reply-by time</span>
        </div>
        <div className="flex justify-between gap-2 rounded-lg bg-danger px-3 py-2.5 text-white">
          <strong>Imminent · BL-3F9A21</strong>
          <span>11 min left</span>
        </div>
        {[
          ["BL-7C2E40", "Full check-in · PHQ-9 19", "Urgent · 3 h 12 m", "bg-[#f4e3d3] text-[#6b3e1c]"],
          ["BL-A51D93", "Quick check · GAD-2 5", "Elevated · today", "bg-[#e9e4f5] text-[#463c6e]"],
          ["BL-0E6B17", "Full check-in · PHQ-9 8", "Routine · 1 day", "bg-[#edf0f1] text-[#34505b]"],
        ].map(([ref, what, badge, tone]) => (
          <div key={ref} className="flex items-center justify-between gap-2.5 rounded-lg border border-track px-3 py-2.5">
            <span className="flex flex-col">
              <strong className="font-semibold">{ref}</strong>
              <span className="text-[0.8125rem] text-muted">{what}</span>
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[0.75rem] font-semibold whitespace-nowrap ${tone}`}>{badge}</span>
          </div>
        ))}
        <span className="text-[0.75rem] text-muted">Synthetic demo data</span>
      </>
    ),
  },
  {
    title: "See when you'll hear back",
    body: "You get a clear timeline with a reply-by time, plus coping cards to use while you wait.",
    label: "Receipt timeline with reply-by time",
    tint: "var(--cat-distress)",
    screen: (
      <>
        <p className="mb-1 font-serif text-[1.125rem]">
          Your check-in is <em className="text-blue">in.</em>
        </p>
        {[
          ["done", "Check-in sent", "Wed 11 Nov, 5:52 pm"],
          ["now", "A clinician is reviewing", "You'll hear from us by Thu 12 Nov, 5 pm"],
          ["next", "Your next step", "By phone call, as you chose"],
          ["next", "Follow-up check-in", "In about 4 weeks"],
        ].map(([state, title, sub]) => (
          <div key={title} className="flex gap-2.5">
            <span
              className={`mt-0.5 size-[18px] shrink-0 rounded-full ${
                state === "done" ? "bg-blue" : state === "now" ? "border-[3px] border-blue bg-surface" : "border-2 border-[#8fa7b0]"
              }`}
            />
            <span>
              <strong>{title}</strong>
              <span className="block text-[0.8125rem] text-muted">{sub}</span>
            </span>
          </div>
        ))}
      </>
    ),
  },
  {
    title: "Track how you're doing",
    body: "Short check-ins every few weeks build a simple chart that you and your clinician share. Gaps are normal.",
    label: "Follow-up chart of mood scores over 12 weeks",
    tint: "var(--cat-ground)",
    screen: (
      <>
        <div className="flex items-baseline justify-between">
          <strong className="text-[0.9375rem]">Mood (PHQ-9)</strong>
          <span className="text-[0.8125rem] text-muted">Lower is better</span>
        </div>
        <svg viewBox="0 0 400 170" width="100%" height="170">
          <g stroke="var(--track)" strokeWidth="1">
            <line x1="30" y1="20" x2="390" y2="20" />
            <line x1="30" y1="70" x2="390" y2="70" />
            <line x1="30" y1="120" x2="390" y2="120" />
          </g>
          <g fill="var(--muted)" fontSize="11">
            <text x="0" y="24">27</text>
            <text x="0" y="74">18</text>
            <text x="0" y="124">9</text>
            <text x="44" y="164">Wk 0</text>
            <text x="134" y="164">Wk 4</text>
            <text x="224" y="164">Wk 8</text>
            <text x="314" y="164">Wk 12</text>
          </g>
          <polyline points="60,59 150,81" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
          <polyline points="150,81 240,103" fill="none" stroke="var(--primary)" strokeWidth="2" strokeDasharray="4 5" />
          <polyline points="240,103 330,103" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
          <g fill="var(--primary)">
            <circle cx="60" cy="59" r="5" />
            <circle cx="150" cy="81" r="5" />
            <circle cx="240" cy="103" r="5" />
            <circle cx="330" cy="103" r="5" />
          </g>
          <text x="168" y="98" fill="var(--muted)" fontSize="11">
            missed, that&apos;s OK
          </text>
        </svg>
        <span className="text-[0.8125rem] text-muted">From 20 to 12 since the first check-in.</span>
      </>
    ),
  },
];

const PREVIEW = [
  { id: "breathing", Icon: BreathingIcon, title: "Paced breathing", time: "2 minutes", cat: CATEGORIES.calm },
  { id: "urge-surfing", Icon: WavesIcon, title: "Urge surfing", time: "5 minutes", cat: CATEGORIES.soothe },
  { id: "grounding", Icon: GroundingIcon, title: "Mindfulness", time: "3 minutes", cat: CATEGORIES.ground },
  { id: "stop", Icon: StopIcon, title: "STOP Skill", time: "1 minute", cat: CATEGORIES.clarity },
];

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
              </div>
              <p className="text-base text-text-2">
                Not ready for a check-in? <Link href="/talk" className="font-medium">Talk to a person</Link>: leave your
                number and the care team will call you.
              </p>
            </div>
          </div>
          <HillsHero />
        </section>

        <section id="how" className={`reveal ${wrap} pt-20 sm:pt-24`}>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h2 className={h2}>
              How it <em className="text-primary">works</em>
            </h2>
            <p className="max-w-[420px] text-body text-text-2">
              Five steps, from your first answer to a follow-up that shows how things are changing.
            </p>
          </div>
          {STEPS.map((step, i) => (
            <div key={step.title} className="reveal flex flex-wrap items-center gap-10 border-t border-line py-10">
              <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3">
                <span className="font-serif text-[3.5rem] leading-none text-primary" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-serif text-[1.75rem] leading-tight font-medium">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </h3>
                <p className="max-w-[440px] text-text-2">{step.body}</p>
              </div>
              <MiniScreen label={step.label} tint={step.tint}>
                {step.screen}
              </MiniScreen>
            </div>
          ))}
        </section>

        <section className={`reveal ${wrap} pt-[72px]`}>
          <p className="mb-5 text-caption font-semibold tracking-[0.08em] text-muted uppercase">How quickly a person replies</p>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] border-t border-line">
            {[
              ["15 min", "If you may be in immediate danger"],
              ["4 hours", "If things are urgent"],
              ["1 day", "For everyone else (one working day)"],
              ["7", "Coping cards approved by a psychiatrist"],
            ].map(([value, label]) => (
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
              Short exercises you can use any time, approved by a psychiatrist. Each colour shows what a card helps with: calming, grounding,
              self-soothing, clarity or mood lifting.
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
              <Link href="/staff" className="inline-flex min-h-11 items-center self-start font-semibold text-blue">
                Care team sign-in →
              </Link>
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
              <span className="mt-3 text-[0.75rem] text-muted">Synthetic demo data</span>
            </div>
          </div>
        </section>

        <section className={`reveal ${wrap} pt-[72px]`}>
          <div className="flex flex-wrap items-center justify-between gap-8 border-t border-line pt-10">
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
            className="tap inline-flex min-h-12 items-center rounded-full bg-bg px-[26px] py-3.5 font-semibold text-ink no-underline"
          >
            I need help now
          </Link>
        </div>
        <div className={`${wrap} flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 py-5 text-base`}>
          <Link href="/talk" className="text-on-dark-2 hover:text-white">Talk to a person</Link>
          <Link href="/coping" className="text-on-dark-2 hover:text-white">Coping cards</Link>
          <Link href="/home" className="text-on-dark-2 hover:text-white">Coming back?</Link>
          <Link href="/staff" className="text-on-dark-2 hover:text-white">Care team sign-in</Link>
          <span className="text-on-dark-2">Prototype. Synthetic data only.</span>
        </div>
      </footer>
    </div>
  );
}
