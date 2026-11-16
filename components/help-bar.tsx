import Link from "next/link";
import en from "@/content/i18n/en.json";

/**
 * On every patient page, at every step, always in the same place (research rule 1):
 * a sticky bar at the bottom on phones and tablets, and a quiet strip in the
 * right-hand margin from 1024px, level with the top bar and in view on scroll.
 */
export function HelpBar() {
  return (
    <nav
      aria-label="Get help"
      className="sticky bottom-0 grid grid-cols-2 gap-2.5 border-t border-line-warm bg-bg px-5 pt-3 pb-4 sm:pb-6 lg:col-start-3 lg:row-start-1 lg:top-6 lg:bottom-auto lg:mt-6 lg:ms-2 lg:w-40 lg:grid-cols-1 lg:gap-2 lg:border-t-0 lg:border-s lg:bg-transparent lg:py-1 lg:ps-5 lg:pe-0"
    >
      <p className="hidden text-[0.8125rem] text-muted lg:block">Need help?</p>
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
