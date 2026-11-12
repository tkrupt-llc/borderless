import Link from "next/link";
import en from "@/content/i18n/en.json";

/** Sticky on every patient page, at every step. */
export function HelpBar() {
  return (
    <nav
      aria-label="Get help"
      className="sticky bottom-0 grid grid-cols-2 gap-2.5 border-t border-line-warm bg-bg px-5 pt-3 pb-4 sm:pb-6"
    >
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
