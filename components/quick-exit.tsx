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
      className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink bg-transparent px-4 text-caption font-medium text-ink"
    >
      Quick exit
    </button>
  );
}
