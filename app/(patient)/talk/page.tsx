import { PatientHeader } from "@/components/patient-header";
import { CallbackForm } from "./callback-form";

// "Talk to a person": the non-urgent route to a human. A short form creates a
// call-back task for the care team (due in one working day). The 24/7 line from
// the approved emergency wording stays available for anyone who wants to talk now.
export default function TalkPage() {
  return (
    <>
      <PatientHeader />
      <div className="flex flex-col gap-4 px-5 pt-5">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
            Talk to a <em className="text-primary">person</em>
          </h1>
          <p className="text-text-2">
            Leave your number and someone from the care team will call you within one working day. You don&apos;t need
            to do a check-in first.
          </p>
        </div>

        <CallbackForm />

        <div className="flex flex-col gap-2 border-t border-line-warm pt-4">
          <p className="font-semibold">Want to talk to someone right now?</p>
          <a
            href="tel:800725462"
            className="flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-ink px-6 font-medium text-ink no-underline"
          >
            Call 800-SAKINA, 24/7
          </a>
          <p className="text-caption text-muted">The number is 800 725462.</p>
          <p className="text-caption text-muted">If you are in danger now, tap &ldquo;I need help now&rdquo;.</p>
        </div>
      </div>
    </>
  );
}
