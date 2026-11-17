import { PatientHeader } from "@/components/patient-header";
import { StartSafety } from "./start-safety";

// Optional safety questions from the crisis page (red-flags.yaml: run_instrument ASQ).
export default function SafetyQuestionsPage() {
  return (
    <>
      <PatientHeader backHref="/help-now" />
      <div className="flex flex-col gap-5 px-5 pt-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
            A few <em className="text-primary">safety questions</em>
          </h1>
          <p className="text-text-2">
            Your answers go straight to the on-call clinician, so they know how best to help you. Most people answer four or five
            questions.
          </p>
        </div>
        <ul className="flex list-disc flex-col gap-1.5 rounded-2xl bg-sky py-3.5 ps-9 pe-4 text-caption text-text-2">
          <li>Yes or no answers. There are no wrong answers.</li>
          <li>We ask these questions of everyone who comes to this page.</li>
          <li>The call buttons stay on screen the whole time. If you are in danger now, call 998.</li>
        </ul>
        <StartSafety />
      </div>
    </>
  );
}
