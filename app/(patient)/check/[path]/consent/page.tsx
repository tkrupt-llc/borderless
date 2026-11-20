import { Suspense } from "react";
import { Backdrop } from "@/components/backdrop";
import { PatientHeader } from "@/components/patient-header";
import { ConsentForm } from "./consent-form";

// "What happens to your answers" (design canvas, Trust, privacy and choice).
// Shown after choosing a path, before the first question. Every promise here is
// true of the prototype; nothing about where data is processed is claimed.
const PROMISES = [
  {
    title: "A clinician reads them",
    body: "Only your care team can see your answers. Never your employer.",
    icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6" />,
  },
  {
    title: "We never sell them",
    body: "No ads. Your answers are not used for marketing.",
    icon: <path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />,
  },
  {
    title: "The assistant only helps you answer",
    body: "It is AI, not a therapist. It never diagnoses you. A person decides your next step.",
    icon: <path d="M4 6h16M4 12h10M4 18h7M17 15l3 3-3 3" />,
  },
  {
    title: "You stay in control",
    body: "Pause any time. Delete your answers whenever you like.",
    icon: <path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3" />,
  },
];

export default function ConsentPage() {
  return (
    <>
      <Backdrop side="left" />
      <PatientHeader backHref="/start" />
      <div className="anim-pop flex flex-col gap-1 px-5 pt-6">
        <p className="text-caption text-muted">Before you start</p>
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          What happens to <em className="text-primary">your answers</em>
        </h1>
        <p className="text-caption text-text-2">For adults aged 18 and over.</p>
      </div>
      <ul className="anim-pop anim-delay-1 mx-5 mt-4 flex flex-col gap-4 rounded-[20px] bg-surface p-5">
        {PROMISES.map((p) => (
          <li key={p.title} className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="var(--blue)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {p.icon}
              </svg>
            </span>
            <span className="flex flex-col">
              <strong className="font-semibold">{p.title}</strong>
              <span className="text-caption text-text-2">{p.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mx-5 mt-3 rounded-[14px] bg-ai-soft px-3.5 py-3 text-caption text-text-2">
        If you tell us you might be in danger, the on-call clinician is alerted straight away.
      </p>
      {/* The form reads the path from the URL, so it streams in behind Suspense. */}
      <Suspense>
        <ConsentForm />
      </Suspense>
    </>
  );
}
