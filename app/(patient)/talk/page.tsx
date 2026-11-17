import Link from "next/link";
import { Backdrop } from "@/components/backdrop";
import { PatientHeader } from "@/components/patient-header";
import { TalkOptions } from "./talk-options";

// "Talk to someone" (design canvas 2c): the non-urgent route to a real person.
// A clear way out to urgent help sits above the options.
export default function TalkPage() {
  return (
    <>
      <Backdrop side="left" />
      <PatientHeader />
      <div className="flex flex-col gap-4 px-5 pt-6">
        <div className="anim-pop">
          <p className="text-caption text-muted">Not urgent</p>
          <h1 className="mt-1 font-serif text-[1.875rem] leading-tight font-normal">
            Talk to <em className="text-primary">someone</em>
          </h1>
          <p className="mt-1.5 text-text-2">A real person from your care team. Choose what suits you.</p>
        </div>

        {/* Crisis content never animates or waits (design motion rules). */}
        <Link
          href="/help-now"
          className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border-2 border-danger bg-surface px-3.5 py-3 text-ink no-underline hover:text-ink"
        >
          <span className="flex flex-col">
            <strong className="font-semibold">Might you be in danger?</strong>
            <span className="text-caption text-text-2">Don&apos;t wait. Get help now.</span>
          </span>
          <span className="rounded-full bg-danger px-3.5 py-2 text-caption font-semibold whitespace-nowrap text-white">I need help now</span>
        </Link>

        <TalkOptions />
      </div>
    </>
  );
}
