"use client";

import { useEffect, useRef, useState } from "react";

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

export const STEPS: { title: string; body: string; screen: React.ReactNode; label: string; tint: string }[] = [
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


/**
 * "How it works" (design canvas): the five steps scroll by on the left; the
 * matching screen stays in view on the right, with progress dots. On narrow
 * screens each step shows its screen inline instead.
 */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const step = STEPS[active];
  return (
    <div className="flex flex-wrap items-start gap-12">
      <div className="min-w-0 flex-[1_1_380px]">
        {STEPS.map((st, i) => (
          <div
            key={st.title}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-step={i}
            className="flex flex-col justify-center gap-3 border-t border-line py-6 min-[861px]:min-h-[62vh]"
          >
            <div className="transition-opacity duration-[400ms] max-[860px]:!opacity-100" style={{ opacity: active === i ? 1 : 0.4 }}>
              <span className="font-serif text-[3.5rem] leading-none text-primary" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 font-serif text-[1.875rem] leading-tight font-medium">
                <span className="sr-only">Step {i + 1}: </span>
                {st.title}
              </h3>
              <p className="mt-3 max-w-[440px] text-text-2">{st.body}</p>
            </div>
            <div className="mt-4 min-[861px]:hidden">
              <MiniScreen label={st.label} tint={st.tint}>
                {st.screen}
              </MiniScreen>
            </div>
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-[1_1_460px] self-stretch max-[860px]:hidden">
        <div className="sticky top-24">
          <div className="mb-3 flex gap-1.5" aria-hidden="true">
            {STEPS.map((st, i) => (
              <span
                key={st.title}
                className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${active === i ? "w-7 bg-primary" : "w-1.5 bg-line"}`}
              />
            ))}
          </div>
          <div key={active} className="how-fade">
            <MiniScreen label={step.label} tint={step.tint}>
              {step.screen}
            </MiniScreen>
          </div>
        </div>
      </div>
    </div>
  );
}
