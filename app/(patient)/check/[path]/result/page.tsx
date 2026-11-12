import { PatientHeader } from "@/components/patient-header";
import { ResultCard } from "./result-card";

// The result card after a check-in. Static shell; the scores come from the
// finished check-in kept in this tab.
export default function ResultPage() {
  return (
    <>
      <PatientHeader />
      <ResultCard />
    </>
  );
}
