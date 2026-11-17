import { Suspense } from "react";
import { PatientHeader } from "@/components/patient-header";
import { StartFollowUp } from "./start-follow-up";

// The private follow-up link. It shows nothing about earlier answers: anyone
// holding the link can only start a new follow-up, which the person then sees
// compared with their earlier check-ins once they have answered.
export default function FollowUpPage({ params }: PageProps<"/f/[token]">) {
  return (
    <>
      <PatientHeader />
      <div className="flex flex-col gap-5 px-5 pt-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
            Welcome <em className="text-primary">back</em>
          </h1>
          <p className="text-text-2">
            This is your follow-up check-in. Answering the same questions again shows you and your clinician how things have changed.
          </p>
        </div>
        <ul className="flex flex-col gap-1.5 rounded-2xl bg-sky px-4 py-3.5 text-caption text-text-2">
          <li>16 questions about mood and worry, about 4 minutes</li>
          <li>You&apos;ll see how your answers compare with last time</li>
          <li>Your care team reads it, as before. You can stop at any time.</li>
        </ul>
        <Suspense>
          <StartFollowUp params={params} />
        </Suspense>
      </div>
    </>
  );
}
