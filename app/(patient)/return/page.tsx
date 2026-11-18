import { Backdrop } from "@/components/backdrop";
import { PatientHeader } from "@/components/patient-header";
import { ReturnForm } from "./return-form";

// "Coming back?": restores a check-in on any device with its reference and return code.
export default function ReturnPage() {
  return (
    <>
      <Backdrop side="left" />
      <PatientHeader backHref="/start" />
      <div className="anim-pop flex flex-col gap-1.5 px-5 pt-6">
        <p className="text-caption text-muted">Coming back?</p>
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          Find your <em className="text-primary">check-in</em>
        </h1>
        <p className="text-text-2">
          Enter the reference and return code you were given after your check-in. They bring your timeline back on any
          device.
        </p>
      </div>
      <ReturnForm />
    </>
  );
}
