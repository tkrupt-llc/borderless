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
 * Back, the logo as a link to the home page, and Quick exit.
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
        <Link href="/" aria-label="borderless home page" className="no-underline">
          <Logo />
        </Link>
      </div>
      <QuickExit />
    </div>
  );
}
