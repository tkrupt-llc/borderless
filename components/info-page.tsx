import { PatientHeader } from "@/components/patient-header";

/** A plain information page (privacy, terms, accessibility, contact) in the patient layout. */
export function InfoPage({ eyebrow, title, em, children }: { eyebrow: string; title: string; em: string; children: React.ReactNode }) {
  return (
    <>
      <PatientHeader backHref="/" />
      <article className="flex flex-col gap-5 px-5 pt-6 pb-4 [&_h2]:text-[1.125rem] [&_h2]:font-semibold [&_li]:text-text-2 [&_p]:text-text-2 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:ps-5">
        <div>
          <p className="text-caption text-muted">{eyebrow}</p>
          <h1 className="mt-1 font-serif text-[1.875rem] leading-tight font-normal">
            {title} <em className="text-primary">{em}</em>
          </h1>
        </div>
        {children}
      </article>
    </>
  );
}
