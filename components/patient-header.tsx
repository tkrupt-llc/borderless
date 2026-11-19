import Link from "next/link";
import { Logo } from "./logo";
import { QuickExit } from "./quick-exit";
import { BackButton } from "./back-button";

const backClass = "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-sage-soft";

function Arrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path d="M14 4l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Top bar of every patient page (research: "a way out of everything"):
 * Back, Home, "Coming back?" (find a check-in with a reference and code),
 * the logo as a link to the home page, and Quick exit on the far side.
 * Back follows the browser history; backHref is where it goes when there is
 * no history (e.g. the previous question), otherwise the home page.
 */
export function PatientHeader({ backHref }: { backHref?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-5 pt-4 sm:pt-6">
      <div className="-ms-2.5 flex min-w-0 items-center gap-1">
        <BackButton fallback={backHref ?? "/"} className={backClass}>
          <Arrow />
        </BackButton>
        {/* A visible Home button: the logo alone did not read as a link. */}
        <Link href="/" aria-label="Home" className={backClass}>
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <path
              d="M3.5 10.5L11 4l7.5 6.5M5.5 9v8.5h4v-5h3v5h4V9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <Link href="/return" aria-label="Coming back? Find your check-in" title="Coming back? Find your check-in" className={backClass}>
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <circle cx="7.5" cy="11" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M11 11h8M16 11v3M19 11v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
        <Link href="/" aria-label="borderless home page" className="ms-1 no-underline">
          <Logo compact />
        </Link>
      </div>
      <QuickExit />
    </div>
  );
}
