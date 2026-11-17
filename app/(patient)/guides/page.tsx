import Link from "next/link";
import { PatientHeader } from "@/components/patient-header";
import guides from "@/content/guides/guides.json";
import { FaithGuide } from "./faith-guide";

// Self-help guides: the psychiatrist's approved wording, word for word
// (content/guides/guides.json). Shown at the self-help level and while waiting.
export default function GuidesPage() {
  const shown = guides.guides.filter((g) => !("optIn" in g && g.optIn));
  const faith = guides.guides.find((g) => "optIn" in g && g.optIn);
  return (
    <>
      <PatientHeader />
      <div className="flex flex-col gap-1.5 px-5 pt-5">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          Self-help <em className="text-primary">guides</em>
        </h1>
        <p className="text-text-2">Short guides for while you wait, or for any time.</p>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4">
        {shown.map((g) => (
          <section key={g.id} aria-labelledby={`g-${g.id}`} className="anim-pop flex flex-col gap-2 rounded-2xl bg-surface px-5 py-4">
            <h2 id={`g-${g.id}`} className="font-serif text-[1.375rem] leading-tight font-normal">
              {g.title}
            </h2>
            <p className="text-ink">{g.text}</p>
            <p className="text-caption text-text-2">
              {guides.ending.split("talk to a person")[0]}
              <Link href="/talk">talk to a person</Link>
              {guides.ending.split("talk to a person")[1]}
            </p>
          </section>
        ))}
        {faith && <FaithGuide title={faith.title} text={faith.text} ending={guides.ending} />}
        <Link href="/coping" className="inline-flex min-h-11 items-center self-start text-caption text-primary-dark underline underline-offset-2">
          Coping cards
        </Link>
      </div>
    </>
  );
}
