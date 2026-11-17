import { Suspense } from "react";
import { Backdrop } from "@/components/backdrop";
import { PatientHeader } from "@/components/patient-header";
import { ContactForm } from "./contact-form";

// "How should we contact you" (design canvas, Trust, privacy and choice). Shown
// once the check-in has gone to a clinician, before the result. Optional.
export default function ContactPage() {
  return (
    <>
      <Backdrop side="left" />
      <PatientHeader />
      <div className="anim-pop flex flex-col gap-1 px-5 pt-6">
        <p className="text-caption text-muted">Last step</p>
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          How should we <em className="text-primary">contact you?</em>
        </h1>
        <p className="text-text-2">Choose what feels safe and private for you.</p>
      </div>
      {/* The form reads the path from the URL, so it streams in behind Suspense. */}
      <Suspense>
        <ContactForm />
      </Suspense>
    </>
  );
}
