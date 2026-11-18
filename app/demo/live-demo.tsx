"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { RuleFile } from "@/lib/contracts/rules";
import { factsFromAnswers } from "@/lib/rules/engine";
import { runSafetyRules } from "@/lib/rules/safety";
import { proposeStep, STEP_NAMES } from "@/lib/rules/routing";
import { factsFromScores, scoreAll } from "@/lib/rules/scoring";
import { stepsFor } from "@/lib/check/paths";
import { nextAskedIndex } from "@/lib/check/conditions";
import { BreathingPacer } from "@/app/(patient)/coping/[card]/card-parts";

// The live demo (design v2 interactive prototype): one check-in, two views.
// It runs the REAL item bank, scoring, safety rules and routing rules in the
// browser, but keeps everything in memory: nothing is ever saved.

type Rules = { redFlags: RuleFile; bpdAdhd: RuleFile; routing: RuleFile };
type Msg = { from: "bot" | "me"; text: string; small?: string };
type Tier = "imminent" | "urgent" | "elevated" | "normal";

const QUICK = stepsFor("quick");
const SAFETY = stepsFor("safety").filter((s) => s.item.instrument === "ASQ");
const DUE: Record<Tier, string> = { imminent: "now", urgent: "4 h", elevated: "1 day", normal: "1 day" };
const TIER_WORD: Record<Tier, string> = { imminent: "Imminent", urgent: "Urgent", elevated: "Elevated", normal: "Routine" };
const TONE: Record<Tier | "none" | "progress", string> = {
  imminent: "bg-danger text-white",
  urgent: "bg-[#f4e3d3] text-[#6b3e1c]",
  elevated: "bg-[#e9e4f5] text-[#463c6e]",
  normal: "bg-[#edf0f1] text-[#34505b]",
  none: "bg-[#edf0f1] text-[#4f6670]",
  progress: "bg-[#e3eef2] text-[#1c3a48]",
};
const INTRO: Msg[] = [
  { from: "bot", small: "borderless assistant", text: "Hi. I'll ask a few short questions, one at a time. A clinician reads every answer. You can stop whenever you like." },
  { from: "bot", text: "How would you like to start?" },
];

type State = {
  msgs: Msg[];
  phase: "start" | "quick" | "done" | "crisis" | "safety" | "safety-done";
  index: number; // question index within the current list
  answers: Record<string, number>;
  helpNow: boolean;
  typing: boolean;
  breathing: boolean;
};
const fresh = (): State => ({ msgs: INTRO, phase: "start", index: 0, answers: {}, helpNow: false, typing: false, breathing: false });

export function LiveDemo({ rules }: { rules: Rules }) {
  const [s, setS] = useState<State>(fresh);
  const [still, setStill] = useState(false);
  const token = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [s.msgs.length, s.typing, s.phase, s.breathing]);

  // The real rules, run on the answers so far (as the server does on every answer).
  const scores = scoreAll(s.answers);
  const facts = { ...factsFromAnswers(s.answers), ...factsFromScores(scores), "flag.help_now": s.helpNow };
  const safety = runSafetyRules({ redFlags: rules.redFlags, bpdAdhd: rules.bpdAdhd }, facts);
  const finished = s.phase === "done";
  const proposal = finished ? proposeStep(rules.routing, { ...facts, "path.quick": true, "field.medical_conditions": false }) : null;
  const tier: Tier | null = safety.tier ?? (finished ? "normal" : null);
  const phq = scores.find((x) => x.instrument === "PHQ2")?.total ?? (s.answers["PHQ2-1"] ?? 0) + (s.answers["PHQ2-2"] ?? 0);
  const gad = scores.find((x) => x.instrument === "GAD2")?.total ?? (s.answers["GAD2-1"] ?? 0) + (s.answers["GAD2-2"] ?? 0);

  /** Bot reply after a short typing pause (never in a crisis: crisis content never waits). */
  function later(next: Partial<State>, reply: Msg) {
    const t = ++token.current;
    setS((cur) => ({ ...cur, ...next, typing: true }));
    setTimeout(() => {
      if (token.current !== t) return;
      setS((cur) => ({ ...cur, typing: false, msgs: [...cur.msgs, reply] }));
    }, 750);
  }

  function ask(list: typeof QUICK, i: number): Msg {
    const step = list[i];
    return { from: "bot", small: `${step.section} · ${step.indexInSection} of ${step.sectionSize}`, text: step.item.text.en };
  }

  function crisis(cur: State, extra: Partial<State> = {}): State {
    token.current++;
    return {
      ...cur,
      ...extra,
      typing: false,
      phase: "crisis",
      msgs: [
        ...(extra.msgs ?? cur.msgs),
        { from: "bot", text: "Thank you for telling me. Your safety comes first. I've alerted your care team, and these numbers connect you to help right now." },
      ],
    };
  }

  function answer(label: string, value: number) {
    const list = s.phase === "safety" ? SAFETY : QUICK;
    const step = list[s.index];
    const answers = { ...s.answers, [step.item.id]: value };
    const msgs: Msg[] = [...s.msgs, { from: "me", text: label }];
    const result = runSafetyRules(
      { redFlags: rules.redFlags, bpdAdhd: rules.bpdAdhd },
      { ...factsFromAnswers(answers), ...factsFromScores(scoreAll(answers)), "flag.help_now": s.helpNow },
    );
    if (s.phase === "quick" && result.takeover) {
      setS(crisis(s, { answers, msgs }));
      return;
    }
    if (s.phase === "safety") {
      const ids = SAFETY.map((x) => x.item.id);
      const next = nextAskedIndex(ids, s.index, answers);
      if (next === null) {
        setS({ ...s, answers, msgs: [...msgs, { from: "bot", text: "Thank you for telling me. That took courage. The on-call clinician has your answers." }], phase: "safety-done" });
      } else {
        setS({ ...s, answers, index: next, msgs: [...msgs, ask(SAFETY, next)] });
      }
      return;
    }
    if (s.index + 1 < QUICK.length) {
      later({ answers, msgs, index: s.index + 1 }, ask(QUICK, s.index + 1));
    } else {
      later({ answers, msgs, phase: "done" }, { from: "bot", text: "Thank you. That's everything for now." });
    }
  }

  const options: { label: string; onClick: () => void; tone: "main" | "off" | "danger" | "calm" }[] = s.typing
    ? []
    : s.phase === "start"
      ? [
          { label: "Start quick check", tone: "main", onClick: () => setS({ ...s, phase: "quick", index: 0, msgs: [...s.msgs, { from: "me", text: "Start quick check" }, ask(QUICK, 0)] }) },
          { label: "I'm not safe right now", tone: "danger", onClick: () => goCrisis() },
        ]
      : s.phase === "quick" || s.phase === "safety"
        ? (s.phase === "safety" ? SAFETY : QUICK)[s.index].item.options.map((o) => ({ label: o.label.en, tone: "off" as const, onClick: () => answer(o.label.en, o.value) }))
        : s.phase === "crisis"
          ? [
              ...(s.breathing ? [] : [{ label: "Breathe with me", tone: "calm" as const, onClick: () => setS({ ...s, breathing: true }) }]),
              { label: "Answer 4 safety questions", tone: "off", onClick: () => setS({ ...s, phase: "safety", index: 0, msgs: [...s.msgs, { from: "me", text: "Answer 4 safety questions" }, ask(SAFETY, 0)] }) },
            ]
          : [
              ...(s.breathing ? [] : [{ label: "Try a breathing card", tone: "calm" as const, onClick: () => setS({ ...s, breathing: true }) }]),
              { label: "Restart demo", tone: "off", onClick: () => restart() },
            ];

  function goCrisis() {
    if (s.phase === "crisis" || s.phase === "safety" || s.phase === "safety-done") return;
    setS(crisis(s, { helpNow: true, msgs: [...s.msgs, { from: "me", text: "I'm not safe right now" }] }));
  }
  function restart() {
    token.current++;
    setS(fresh());
  }

  const inCrisis = s.phase === "crisis" || s.phase === "safety" || s.phase === "safety-done";
  const answered = QUICK.filter((q) => s.answers[q.item.id] !== undefined).length;
  const progressLabel = inCrisis ? "Help first" : s.phase === "start" ? "Quick check · 5 questions" : finished ? "Done · 5 of 5" : `Question ${s.index + 1} of 5`;
  const badgeKey: Tier | "none" | "progress" = tier ?? (s.phase === "start" ? "none" : "progress");
  const badgeText = tier ? `${TIER_WORD[tier]} · ${DUE[tier]}` : s.phase === "start" ? "Not started" : `Answering ${answered} of 5`;
  const ruleText =
    safety.fired.length > 0
      ? safety.fired.map((r) => `${r.id}: ${r.description}`).join(" · ")
      : proposal
        ? proposal.step !== null
          ? `${proposal.reasons.join("; ")} → step ${proposal.step}: ${STEP_NAMES[proposal.step]}`
          : "No rule fired → routine review"
        : s.phase === "start"
          ? "Waiting for answers…"
          : "Scoring as answers arrive…";
  const pill = "tap min-h-11 cursor-pointer rounded-full px-4 text-[0.9375rem] font-medium";
  const toneCls = {
    main: "border-[1.5px] border-primary bg-primary text-white",
    off: "border-[1.5px] border-line bg-surface text-ink",
    danger: "border-[1.5px] border-danger bg-surface font-semibold text-danger",
    calm: "border-[1.5px] border-blue bg-sky text-blue-ink",
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg text-[1rem] leading-normal">
      <div aria-hidden="true" className={`absolute -top-56 -left-40 size-[520px] rounded-full bg-sky ${still ? "" : "demo-drift"}`} />
      <div aria-hidden="true" className={`absolute -right-32 -bottom-52 size-[420px] rounded-full bg-cat-distress ${still ? "" : "demo-drift"}`} style={{ animationDelay: "-6s" }} />

      <div className="relative mx-auto flex max-w-[1240px] flex-col gap-5 px-4 pt-5 pb-10 sm:px-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true">
              <path d="M32.3 9.7 A16 16 0 1 0 32.3 30.3" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" />
              <circle cx="27" cy="20" r="3.6" fill="var(--clay)" />
            </svg>
            <div>
              <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
                One check-in, <em className="text-primary">two views</em>
              </h1>
              <p className="text-[0.9375rem] text-muted">
                Answer as a patient on the left. Watch the clinician console update on the right. Practice data only: nothing is saved.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStill((v) => !v)} className={`${pill} border-[1.5px] border-line bg-surface`}>
              {still ? "Background motion: off" : "Background motion: on"}
            </button>
            <button type="button" onClick={restart} className={`${pill} border-[1.5px] border-ink bg-surface`}>
              Restart demo
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-stretch gap-5">
          {/* ------------------------------------------------ patient view */}
          <section aria-label="Patient view" className="flex min-w-0 flex-[1_1_420px] flex-col overflow-hidden rounded-[28px] bg-surface shadow-[0_20px_60px_rgba(31,42,28,0.10)]">
            <div className="flex items-center justify-between gap-2.5 border-b border-[#ece9e2] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-ai-soft" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 40 40">
                    <path d="M32.3 9.7 A16 16 0 1 0 32.3 30.3" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" />
                    <circle cx="27" cy="20" r="3.6" fill="var(--clay)" />
                  </svg>
                </span>
                <span className="flex flex-col leading-tight">
                  <strong className="font-semibold">borderless assistant</strong>
                  <span className="text-[0.8125rem] text-muted">AI assistant, not a therapist · a clinician reads everything</span>
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 px-5 pt-2.5">
              <div className="flex justify-between text-[0.8125rem] text-muted">
                <span>{progressLabel}</span>
                <span>Demo</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#ece9e2]">
                <div className="h-1.5 rounded-full bg-primary transition-[width] duration-[400ms]" style={{ width: `${s.phase === "start" ? 0 : Math.round((answered / 5) * 100)}%` }} />
              </div>
              <div className="flex min-h-[26px] flex-wrap gap-1.5">
                {[["Mood", 2], ["Worry", 4], ["Safety", 5]].map(([name, need]) =>
                  answered >= (need as number) ? (
                    <span key={name} className="anim-pop inline-flex items-center gap-1 rounded-full bg-cat-ground py-0.5 ps-1.5 pe-2.5 text-[0.8125rem] font-medium text-text-on-sage">
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                        <path className="anim-draw" d="M3.5 8.5l3 3 6-7" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {name}
                      <span className="sr-only"> done</span>
                    </span>
                  ) : (
                    <span key={name} className="inline-flex items-center rounded-full border border-dashed border-line px-2.5 py-0.5 text-[0.8125rem] text-muted">
                      {name}
                    </span>
                  ),
                )}
              </div>
            </div>

            <div className="flex h-[440px] flex-col overflow-y-auto px-5 py-4" aria-live="polite">
              <div className="flex flex-col gap-2.5">
                {s.msgs.map((m, i) =>
                  m.from === "bot" ? (
                    <div key={i} className="anim-pop max-w-[85%] self-start rounded-[18px_18px_18px_6px] bg-ai-soft px-3.5 py-3">
                      {m.small && <span className="mb-0.5 block text-[0.8125rem] text-ai-ink">{m.small}</span>}
                      {m.text}
                    </div>
                  ) : (
                    <div key={i} className="anim-pop max-w-[80%] self-end rounded-[18px_18px_6px_18px] bg-primary px-3.5 py-2.5 font-medium text-white">
                      {m.text}
                    </div>
                  ),
                )}
                {s.typing && (
                  <div className="anim-pop flex gap-1.5 self-start rounded-[18px_18px_18px_6px] bg-ai-soft px-4 py-3.5" role="status">
                    <span className="sr-only">The assistant is typing</span>
                    <span className="typing-dot" aria-hidden="true" />
                    <span className="typing-dot" aria-hidden="true" />
                    <span className="typing-dot" aria-hidden="true" />
                  </div>
                )}
                {inCrisis && (
                  <div className="flex flex-col gap-2.5 rounded-[20px] border-2 border-danger bg-surface p-4">
                    <strong className="font-serif text-[1.25rem] font-medium">You&apos;re not alone. Help is here now.</strong>
                    <span className="text-[0.875rem] text-text-2">In the real service your care team is alerted now. If you need help now, call:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <a href="tel:998" className="flex min-h-12 items-center justify-center rounded-[14px] bg-danger font-semibold text-white no-underline hover:text-white">
                        Call 998 · Ambulance
                      </a>
                      <a href="tel:999" className="flex min-h-12 items-center justify-center rounded-[14px] bg-danger font-semibold text-white no-underline hover:text-white">
                        Call 999 · Police
                      </a>
                    </div>
                  </div>
                )}
                {finished && tier && (
                  <div className="anim-pop flex flex-col gap-2 rounded-[20px] bg-sky p-4">
                    <span className="text-[0.75rem] font-semibold tracking-[0.06em] text-blue uppercase">Your check-in is in</span>
                    <span className="flex items-center gap-2.5">
                      <span className="size-3.5 shrink-0 rounded-full bg-blue" />
                      Check-in sent
                    </span>
                    <span className="flex items-center gap-2.5">
                      <span className="anim-pulse size-3.5 shrink-0 rounded-full border-[3px] border-blue" />
                      <span>
                        <strong>A clinician is reviewing.</strong> You&apos;ll hear from us within {tier === "urgent" ? "4 hours" : "1 working day"}.
                      </span>
                    </span>
                    <span className="flex items-center gap-2.5 text-[#34505b]">
                      <span className="size-3.5 shrink-0 rounded-full border-2 border-[#8fa7b0]" />
                      Follow-up check-in in about 4 weeks
                    </span>
                  </div>
                )}
                {s.breathing && (
                  <div className="anim-pop flex flex-col items-center gap-2 rounded-[20px] bg-sky p-4">
                    <span className="text-[0.75rem] font-semibold tracking-[0.06em] text-blue uppercase">Calming · Paced breathing</span>
                    <BreathingPacer fill="var(--sky-deep)" ring="rgba(255,255,255,0.7)" />
                    <button type="button" onClick={() => setS({ ...s, breathing: false })} className={`${pill} border-[1.5px] border-blue bg-surface text-blue`}>
                      I&apos;m done
                    </button>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            <div className="flex min-h-[68px] flex-wrap gap-2 border-t border-[#ece9e2] px-5 py-3">
              {options.map((o) => (
                <button key={o.label} type="button" onClick={o.onClick} className={`${pill} ${toneCls[o.tone]}`}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 bg-bg px-5 pt-2.5 pb-4">
              <button type="button" onClick={goCrisis} className="min-h-[46px] cursor-pointer rounded-full bg-ink font-semibold text-white">
                I need help now
              </button>
              <span className="flex min-h-[46px] items-center justify-center rounded-full border-[1.5px] border-ink text-center text-[0.875rem] text-text-2">
                Talk to someone (call-back)
              </span>
            </div>
          </section>

          {/* ---------------------------------------------- clinician view */}
          <section aria-label="Clinician view" className="console flex min-w-0 flex-[1_1_460px] flex-col gap-3.5 rounded-[28px] border border-line-warm p-5">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true">
                  <path d="M32.3 9.7 A16 16 0 1 0 32.3 30.3" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" />
                  <circle cx="27" cy="20" r="3.6" fill="var(--clay)" />
                </svg>
                <strong className="text-[1.0625rem]">
                  Clinician console · <span className="text-blue">Review queue</span>
                </strong>
              </div>
              <span className="flex items-center gap-1.5 text-[0.8125rem] text-text-2">
                <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
                Live
              </span>
            </div>

            {tier === "imminent" && (
              <div role="alert" className="anim-slide flex flex-wrap items-center justify-between gap-2.5 rounded-[14px] bg-danger px-4 py-3 text-white">
                <span className="flex flex-col">
                  <strong>Imminent · BL-DEMO01 · act now</strong>
                  <span className="text-[0.8125rem] text-[#fbe9e7]">{ruleText}</span>
                </span>
                <span className="rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-semibold text-danger">Open and call now</span>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-line-warm bg-surface">
              <div className="grid grid-cols-3 border-b border-line-warm px-3.5 py-2.5 text-[0.75rem] text-muted">
                <span>Patient</span>
                <span>Scores</span>
                <span>Reply by</span>
              </div>
              <div
                key={badgeKey}
                className={`grid grid-cols-3 items-center px-3.5 py-3 ${tier ? (tier === "imminent" ? "anim-highlight-red bg-[#fbedec]" : "anim-highlight bg-[#eaf2f5]") : ""}`}
                style={{ boxShadow: `inset 4px 0 0 ${tier === "imminent" ? "var(--danger)" : "var(--blue)"}` }}
              >
                <span className="flex flex-col">
                  <strong>BL-DEMO01</strong>
                  <span className="text-[0.75rem] text-muted">This demo{tier ? " · just now" : ""}</span>
                </span>
                <span className="text-[0.875rem]">{s.phase === "start" ? "–" : `PHQ-2 ${phq} · GAD-2 ${gad}`}</span>
                <span>
                  <span key={badgeText} className={`${tier ? "anim-slide" : ""} inline-block rounded-full px-2.5 py-1 text-[0.75rem] font-semibold whitespace-nowrap ${TONE[badgeKey]}`}>
                    {badgeText}
                  </span>
                </span>
              </div>
              {[
                ["BL-7C2E40", "PHQ-9 19 · GAD-7 12", "Urgent · 3 h 12 m", TONE.urgent],
                ["BL-A51D93", "PHQ-2 4 · GAD-2 5", "Elevated · today", TONE.elevated],
                ["BL-0E6B17", "PHQ-9 8 · GAD-7 6", "Routine · 1 day", TONE.normal],
              ].map(([ref, sc, badge, tone]) => (
                <div key={ref} className="grid grid-cols-3 items-center border-t border-[#e6edf0] px-3.5 py-3">
                  <strong>{ref}</strong>
                  <span className="text-[0.875rem]">{sc}</span>
                  <span>
                    <span className={`rounded-full px-2.5 py-1 text-[0.75rem] font-semibold whitespace-nowrap ${tone}`}>{badge}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-1 flex-col gap-2.5 rounded-2xl border border-line-warm bg-surface p-4">
              <div className="flex items-center justify-between">
                <strong>BL-DEMO01 · summary</strong>
                <span className="text-[0.75rem] text-muted">Updates as they answer</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[["Mood · PHQ-2", phq], ["Worry · GAD-2", gad]].map(([label, v]) => (
                  <div key={label as string} className="rounded-xl bg-sage-soft p-3">
                    <span className="text-[0.75rem] text-muted">{label}</span>
                    <div className="font-serif text-[1.875rem] leading-tight">
                      {v}
                      <span className="text-[0.9375rem] text-muted"> / 6</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#d5e2e7]">
                      <div className="h-1.5 rounded-full bg-blue transition-[width] duration-[400ms]" style={{ width: `${Math.round(((v as number) / 6) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-dashed border-line bg-sage-mist p-3">
                <span className="block text-[0.75rem] text-muted">Rule that fired (the real rules file)</span>
                <span className="text-[0.9375rem]">{ruleText}</span>
              </div>
              <span className="text-[0.75rem] text-muted">Scores and routing use fixed rules, not AI. The clinician decides the next step.</span>
            </div>
            <p className="text-[0.8125rem] text-text-2">
              Clinics: this is the same queue your team uses. <Link href="/staff">Care team sign-in</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
