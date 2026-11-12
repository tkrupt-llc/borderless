import Link from "next/link";
import { PatientHeader } from "@/components/patient-header";
import { BreathingIcon, PhoneIcon } from "@/components/icons";
import en from "@/content/i18n/en.json";
import { AlertCareTeam } from "./alert-care-team";

// Crisis page. Red is used here (call buttons) and nowhere else on patient pages.
// TODO(DB): opening this page raises RF-HELP-NOW (flag.help_now) and an urgent task.
const callButton =
  "flex min-h-[60px] items-center gap-3.5 rounded-2xl bg-danger px-[18px] text-white no-underline hover:text-white";

export default function HelpNowPage() {
  return (
    <>
      <PatientHeader />

      <div className="flex flex-col gap-2 px-5 pt-6">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          You&apos;re not alone. Help is here <em className="text-danger">now.</em>
        </h1>
        <p className="text-text-2">{en.emergency.card}</p>
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-5">
        <a href="tel:998" className={callButton}>
          <PhoneIcon />
          <span className="flex flex-col">
            <strong className="font-semibold">Call 998</strong>
            <span className="text-small text-[#FBE9E7]">Ambulance</span>
          </span>
        </a>
        <a href="tel:999" className={callButton}>
          <PhoneIcon />
          <span className="flex flex-col">
            <strong className="font-semibold">Call 999</strong>
            <span className="text-small text-[#FBE9E7]">Police</span>
          </span>
        </a>
        {/* Support line, not an emergency service: primary colour, not red. */}
        <a
          href="tel:800725462"
          className="flex min-h-[60px] items-center gap-3.5 rounded-2xl bg-primary px-[18px] text-white no-underline hover:text-white"
        >
          <PhoneIcon />
          <span className="flex flex-col">
            <strong className="font-semibold">Call 800-SAKINA</strong>
            <span className="text-small text-on-dark">800 725462 · 24/7 support</span>
          </span>
        </a>
        {/* For visitors and expats; opens in a new tab so this page stays open. */}
        <a
          href={en.emergency.outsideUaeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center self-start text-caption text-primary-dark underline underline-offset-2"
        >
          {en.emergency.outsideUae}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <AlertCareTeam />
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-5">
        <Link
          href="/coping/breathing"
          className="flex min-h-11 items-center gap-3 rounded-2xl bg-sage px-4 py-3.5 text-ink no-underline hover:text-ink"
        >
          <BreathingIcon size={36} stroke={2.6} blob="var(--sage-deep)" />
          <span className="flex flex-col">
            <strong className="text-base font-semibold">Breathe with me</strong>
            <span className="text-small text-text-on-sage">While you wait for help</span>
          </span>
        </Link>
        {/* TODO: optional ASQ route (/check/asq) once its wording is approved. */}
      </div>
    </>
  );
}
