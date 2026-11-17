import { Backdrop } from "@/components/backdrop";
import { PatientHeader } from "@/components/patient-header";
import { ReturningHome } from "./returning-home";

// Home for a returning patient (DESIGN v2 rule 4): one next step. The follow-up
// if they chose to remember it on this device, otherwise a gentle way back in.
export default function HomePage() {
  return (
    <>
      <PatientHeader />
      <Backdrop side="right" />
      <ReturningHome />
    </>
  );
}
