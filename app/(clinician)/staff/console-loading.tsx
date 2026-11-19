/**
 * What the console shows while a page loads: the same frame as StaffShell
 * (side bar, top bar) with grey placeholders shaped like the page that is on
 * its way, so nothing jumps when the data arrives. Static: no data, no auth.
 */
type Kind = "queue" | "case" | "insights" | "org";

const NAV = [
  { label: "Review queue", on: ["queue"] },
  { label: "Follow-ups due", on: [] },
  { label: "Escalated", on: [] },
  { label: "Service overview", on: ["insights", "org"] },
] as const;

const LABEL: Record<Kind, string> = {
  queue: "Loading the queue",
  case: "Loading the case",
  insights: "Loading the service overview",
  org: "Loading the organisation view",
};

/** One grey bar. Pulses gently, and not at all with reduced motion. */
function Bar({ className = "", width }: { className?: string; width?: string }) {
  return <span aria-hidden="true" style={width ? { width } : undefined} className={`block rounded-md bg-line-warm motion-safe:animate-pulse ${className}`} />;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div aria-hidden="true" className={`flex flex-col gap-3 rounded-xl border border-line-warm bg-surface px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}

function QueueBody() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Bar className="h-8 w-56" />
        <Bar className="h-4 w-80 max-w-full" />
      </div>
      <div aria-hidden="true" className="flex flex-wrap gap-2">
        {["5rem", "6rem", "5rem", "5rem", "6rem"].map((w, i) => (
          <Bar key={i} className="h-9 rounded-full" width={w} />
        ))}
      </div>
      <div aria-hidden="true" className="overflow-hidden rounded-xl border border-line-warm bg-surface">
        <div className="flex gap-6 border-b border-line-warm px-5 py-3">
          {["w-20", "w-40", "w-24", "w-20", "w-24"].map((w, i) => (
            <Bar key={i} className={`h-3 ${w}`} />
          ))}
        </div>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-line-warm px-5 py-4 last:border-b-0">
            <Bar className="h-5 w-20 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Bar className="h-4 w-3/5" />
              <Bar className="h-3 w-2/5" />
            </div>
            <Bar className="hidden h-4 w-24 sm:block" />
            <Bar className="hidden h-4 w-16 md:block" />
            <Bar className="h-4 w-20" />
          </div>
        ))}
      </div>
    </>
  );
}

function CaseBody() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Bar className="h-4 w-28" />
        <Bar className="h-8 w-72 max-w-full" />
        <div className="flex gap-2">
          <Bar className="h-6 w-20 rounded-full" />
          <Bar className="h-6 w-28 rounded-full" />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <Bar className="h-5 w-32" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-11/12" />
            <Bar className="h-4 w-4/5" />
            <Bar className="mt-1 h-10 w-36 rounded-full" />
          </Card>
          <Card>
            <Bar className="h-5 w-24" />
            <div className="grid grid-cols-2 gap-4">
              <Bar className="h-16" />
              <Bar className="h-16" />
            </div>
          </Card>
          <Card>
            <Bar className="h-5 w-28" />
            {Array.from({ length: 4 }, (_, i) => (
              <Bar key={i} className="h-4 w-full" />
            ))}
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          {["w-28", "w-24", "w-32"].map((w, i) => (
            <Card key={i}>
              <Bar className={`h-5 ${w}`} />
              <Bar className="h-4 w-full" />
              <Bar className="h-4 w-2/3" />
              <Bar className="h-10 w-32 rounded-full" />
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

function InsightsBody({ org = false }: { org?: boolean }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Bar className="h-8 w-64 max-w-full" />
        <Bar className="h-4 w-96 max-w-full" />
      </div>
      <div aria-hidden="true" className={`grid grid-cols-2 overflow-hidden rounded-xl border border-line-warm bg-surface ${org ? "" : "sm:grid-cols-4"}`}>
        {Array.from({ length: org ? 2 : 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 border-line-warm px-5 py-4 not-first:border-s">
            <Bar className="h-3 w-24" />
            <Bar className="h-7 w-16" />
            <Bar className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: org ? 1 : 2 }, (_, i) => (
          <Card key={i}>
            <Bar className="h-5 w-36" />
            {[90, 70, 55, 35].map((w) => (
              <div key={w} className="flex items-center gap-3">
                <Bar className="h-3 w-24 shrink-0" />
                <Bar className="h-3" width={`${w}%`} />
              </div>
            ))}
          </Card>
        ))}
      </div>
    </>
  );
}

export function ConsoleLoading({ kind }: { kind: Kind }) {
  return (
    <div className="flex min-h-dvh w-full flex-col font-sans text-[0.875rem] leading-normal lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-2 border-b border-line-warm bg-surface px-3 pt-3 pb-2 lg:sticky lg:gap-5 lg:py-4 lg:top-0 lg:h-dvh lg:w-60 lg:border-e lg:border-b-0">
        <div className="flex h-8 items-center gap-2 px-2">
          <svg width="22" height="22" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M32.3 9.7 A16 16 0 1 0 32.3 30.3" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" />
            <circle cx="27" cy="20" r="3.6" fill="var(--clay)" />
          </svg>
          <span className="flex flex-col leading-tight">
            <span className="text-[1rem] font-semibold tracking-[-0.01em] text-ink">borderless</span>
            <span className="text-[0.75rem] text-muted">Clinician console</span>
          </span>
        </div>
        <ul aria-hidden="true" className="-mx-3 flex gap-1 overflow-x-hidden px-3 pb-1 lg:mx-0 lg:flex-col lg:px-0 lg:pb-0">
          {NAV.map((n) => (
            <li
              key={n.label}
              className={`flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg px-3 whitespace-nowrap lg:gap-3 text-[0.875rem] ${
                (n.on as readonly string[]).includes(kind) ? "bg-sage font-semibold text-text-on-sage" : "font-medium text-text-2"
              }`}
            >
              <span className="size-[18px] rounded bg-current opacity-20" />
              {n.label}
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="mt-auto hidden items-center gap-3 border-t border-line-warm px-2 pt-4 lg:flex">
          <span className="size-8 shrink-0 rounded-full bg-line-warm motion-safe:animate-pulse" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Bar className="h-3 w-32" />
            <Bar className="h-3 w-16" />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header aria-hidden="true" className="flex min-h-14 items-center justify-end border-b border-line-warm bg-surface px-5 py-2 lg:px-8">
          <Bar className="h-9 w-64" />
        </header>
        <main className="flex min-w-0 flex-1 flex-col gap-5 px-5 py-6 lg:px-8">
          <p role="status" className="sr-only">
            {LABEL[kind]}…
          </p>
          {kind === "queue" && <QueueBody />}
          {kind === "case" && <CaseBody />}
          {kind === "insights" && <InsightsBody />}
          {kind === "org" && <InsightsBody org />}
        </main>
      </div>
    </div>
  );
}
