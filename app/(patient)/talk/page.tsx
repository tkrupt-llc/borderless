import { PatientHeader } from "@/components/patient-header";
import { PhoneIcon } from "@/components/icons";

// "Talk to a person". The 24/7 line is from the approved emergency wording (content/i18n).
// TODO(DB): add "Ask for a call back", which creates a contact task for the care team.
export default function TalkPage() {
  return (
    <>
      <PatientHeader />
      <div className="flex flex-col gap-3 px-5 pt-6">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          Talk to a <em className="text-primary">person</em>
        </h1>
        <p className="text-text-2">A trained listener is available any time, day or night.</p>
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
        <p className="text-caption text-muted">If you are in danger now, tap &ldquo;I need help now&rdquo;.</p>
      </div>
    </>
  );
}
