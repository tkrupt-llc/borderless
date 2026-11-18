import { Suspense } from "react";
import { Backdrop } from "@/components/backdrop";
import { PatientHeader } from "@/components/patient-header";
import { HealthForm } from "./health-form";

// Physical health (optional, consented): after the questions, before contact details.
export default function HealthPage() {
  return (
    <>
      <Backdrop side="right" />
      <PatientHeader />
      <div className="anim-pop flex flex-col gap-1 px-5 pt-6">
        <p className="text-caption text-muted">Optional</p>
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          Your <em className="text-primary">physical health</em>
        </h1>
        <p className="text-text-2">
          Long-term health conditions can affect mood and sleep. Sharing them helps your clinician, but you don&apos;t
          have to.
        </p>
      </div>
      {/* The form reads the path from the URL, so it streams in behind Suspense. */}
      <Suspense>
        <HealthForm />
      </Suspense>
    </>
  );
}
