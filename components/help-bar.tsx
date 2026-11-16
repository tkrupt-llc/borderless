import Link from "next/link";
import en from "@/content/i18n/en.json";

/**
 * On every patient page, at every step, always in the same place (research rule 1):
 * a sticky bar at the bottom on phones and tablets, and a panel beside the
 * content from 1024px, which stays in view while the page scrolls.
 */
export function HelpBar() {
  return (
    <nav
      aria-label="Get help"
      className="sticky bottom-0 grid grid-cols-2 gap-2.5 border-t border-line-warm bg-bg px-5 pt-3 pb-4 sm:pb-6 lg:top-24 lg:bottom-auto lg:mt-24 lg:w-60 lg:shrink-0 lg:grid-cols-1 lg:rounded-2xl lg:border lg:bg-surface lg:p-4"
    >
      <p className="hidden text-caption font-semibold text-ink lg:block">Need help?</p>
      <Link
        href="/help-now"
        className="flex min-h-12 items-center justify-center rounded-full bg-ink px-2 text-center text-caption font-semibold text-white no-underline hover:text-white"
      >
        {en.footer.helpNow}
      </Link>
      <Link
        href="/talk"
        className="flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-ink px-2 text-center text-caption font-medium text-ink no-underline"
      >
        {en.footer.talkToPerson}
      </Link>
    </nav>
  );
}
