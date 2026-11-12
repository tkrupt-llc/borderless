import { Suspense } from "react";
import { PatientHeader } from "@/components/patient-header";
import { ConsentForm } from "./consent-form";

// Shown after choosing a path, before the first question. The form reads the
// path from the URL on the client, so this page is fully static.
export default function ConsentPage() {
  return (
    <>
      <PatientHeader backHref="/start" />
      <div className="flex flex-col gap-2 px-5 pt-5">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          Before we <em className="text-primary">start</em>
        </h1>
        <p className="text-text-2">
          No name or account needed. Choose what happens with your answers. You can change your mind later.
        </p>
      </div>
      {/* The form reads the path from the URL, so it streams in behind Suspense. */}
      <Suspense>
        <ConsentForm />
      </Suspense>
    </>
  );
}
