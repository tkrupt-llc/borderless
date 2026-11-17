/**
 * The hero's example chat (design canvas): plays once on load. Typing dots,
 * the assistant's first message writing itself, the person's reply, the first
 * question, then answer chips. With "reduce motion" it simply shows the result.
 */
export function HeroChat() {
  return (
    <div
      role="img"
      aria-label="Example chat: the assistant explains that a clinician reads every answer, the person asks for a quick check, and the first question appears."
      className="relative mx-4 -mt-28 flex flex-col gap-2 rounded-[22px] bg-surface p-3.5 text-[0.875rem] leading-snug shadow-[0_24px_60px_rgba(31,42,28,0.16)] min-[761px]:absolute min-[761px]:top-7 min-[761px]:right-7 min-[761px]:mx-0 min-[761px]:mt-0 min-[761px]:w-[340px]"
    >
      <div className="flex items-center gap-2 border-b border-[#ece9e2] pb-2" aria-hidden="true">
        <span className="grid size-7 place-items-center rounded-full bg-cat-distress">
          <svg width="18" height="18" viewBox="0 0 40 40">
            <path d="M32.3 9.7 A16 16 0 1 0 32.3 30.3" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" />
            <circle cx="27" cy="20" r="3.6" fill="var(--clay)" />
          </svg>
        </span>
        <span className="flex flex-col leading-tight">
          <strong className="font-semibold">borderless assistant</strong>
          <span className="text-[0.75rem] text-muted">AI assistant, not a therapist</span>
        </span>
      </div>
      <div className="grid" aria-hidden="true">
        <div className="h-typing col-start-1 row-start-1 flex gap-[5px] self-start justify-self-start rounded-[16px_16px_16px_5px] bg-ai-soft px-3.5 py-3">
          <span className="hero-dot" />
          <span className="hero-dot" />
          <span className="hero-dot" />
        </div>
        <div className="h-b1 col-start-1 row-start-1 max-w-[92%] justify-self-start rounded-[16px_16px_16px_5px] bg-ai-soft px-3 py-2.5">
          Hi. I&apos;ll ask a few short questions, one at a time. A clinician reads every answer.
        </div>
      </div>
      <div className="h-b2 self-end rounded-[16px_16px_5px_16px] bg-primary px-3 py-2 font-medium text-white" aria-hidden="true">
        Quick check, please
      </div>
      <div className="h-b3 max-w-[92%] self-start rounded-[16px_16px_16px_5px] bg-ai-soft px-3 py-2.5" aria-hidden="true">
        <span className="block text-[0.75rem] text-ai-ink">Mood · 1 of 2</span>
        Over the last 2 weeks, how often have you had little interest or pleasure in doing things?
      </div>
      <div className="h-chips flex flex-wrap gap-1.5 pt-0.5" aria-hidden="true">
        {["Not at all", "Several days", "More than half"].map((c) => (
          <span key={c} className="rounded-full border-[1.5px] border-line px-2.5 py-1.5">
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
