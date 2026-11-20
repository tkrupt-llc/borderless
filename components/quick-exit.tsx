"use client";

// Leaves for a neutral site with location.replace, so Back cannot return here.
// Clears in-progress answers in this tab and (best effort) the session cookie.
const NEUTRAL_SITE = "https://www.google.com/search?q=weather";

export function QuickExit() {
  return (
    <button
      type="button"
      onClick={() => {
        try {
          sessionStorage.clear();
        } catch {
          // storage blocked: nothing to clear
        }
        try {
          navigator.sendBeacon("/api/exit");
        } catch {
          // never let cleanup delay the exit
        }
        // Embedded on a clinic's website: leave the whole page, not just the panel.
        // The host page's embed.js does the navigation; trying it here too covers
        // pages without the script.
        if (window.self !== window.top) {
          try {
            window.parent.postMessage({ type: "borderless:quick-exit" }, "*");
          } catch {}
          try {
            window.top?.location.replace(NEUTRAL_SITE);
          } catch {}
        }
        window.location.replace(NEUTRAL_SITE);
      }}
      aria-label="Quick exit"
      title="Quick exit: leave this site now"
      className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 rounded-full bg-transparent px-2 text-[0.8125rem] font-medium text-text-2 hover:bg-sage-soft hover:text-ink"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
        <path d="M10 17l-5-5 5-5M5 12h11" />
      </svg>
      Exit
    </button>
  );
}
