"use client";

import { useSearchParams } from "next/navigation";
import { clinicById } from "@/lib/clinics";

/** On the start page when the check-in was opened from a clinic's, employer's or university's website. */
export function ClinicNote() {
  const clinic = clinicById(useSearchParams().get("clinic"));
  if (!clinic) return null;
  if (clinic.kind !== "clinic") {
    // Employers and universities only link to the check-in; they never see anyone's answers.
    return (
      <p className="mx-5 mt-4 rounded-2xl bg-sky px-4 py-2.5 text-caption text-text-2">
        You opened this from <strong className="font-semibold text-ink">{clinic.name}</strong>&apos;s wellbeing page.{" "}
        {clinic.name} never sees your answers or who you are. They see only totals, for groups of 10 people or more.
      </p>
    );
  }
  return (
    <p className="mx-5 mt-4 rounded-2xl bg-sky px-4 py-2.5 text-caption text-text-2">
      Your check-in goes to <strong className="font-semibold text-ink">{clinic.name}</strong>. Their care team reads it.
    </p>
  );
}
