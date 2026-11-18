import Link from "next/link";
import { Backdrop } from "@/components/backdrop";
import { PatientHeader } from "@/components/patient-header";
import support from "@/content/support-options.json";

// "Your support options": local options by stepped-care level, each with who
// it's for, cost, and how the hand-off works. Your clinician picks the right
// one with you; this page explains the choices in plain words.
export default function SupportOptionsPage() {
  return (
    <>
      <Backdrop side="right" />
      <PatientHeader />
      <div className="flex flex-col gap-4 px-5 pt-6">
        <div className="anim-pop">
          <p className="text-caption text-muted">{support.region}</p>
          <h1 className="mt-1 font-serif text-[1.875rem] leading-tight font-normal">
            Your support <em className="text-primary">options</em>
          </h1>
          <p className="mt-1.5 text-text-2">
            From things you can do yourself, to your family doctor, online therapy and specialist care. Your clinician
            chooses the right one with you, and you can always ask for more support.
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          {support.options.map((o) => (
            <li key={o.id} className="flex flex-col gap-2 rounded-[18px] bg-surface p-4">
              <span className="flex items-baseline justify-between gap-3">
                <strong className="text-[1.0625rem] font-semibold">{o.title}</strong>
                {o.step !== null && (
                  <span className="shrink-0 rounded-full bg-sky px-2.5 py-0.5 text-small font-semibold text-blue">Step {o.step}</span>
                )}
              </span>
              <p className="text-caption text-text-2">{o.what}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption">
                <dt className="text-muted">Who it&apos;s for</dt>
                <dd>{o.forWho}</dd>
                <dt className="text-muted">Cost</dt>
                <dd>{o.cost}</dd>
                <dt className="text-muted">How it works</dt>
                <dd>{o.handOff}</dd>
              </dl>
              {"href" in o && o.href && (
                <Link href={o.href} className="inline-flex min-h-11 items-center self-start font-semibold">
                  {o.id === "emergency" ? "Open the crisis page →" : "Open the coping cards →"}
                </Link>
              )}
              {"tel" in o && o.tel && (
                <a
                  href={`tel:${o.tel}`}
                  className="tap flex min-h-11 items-center justify-center rounded-full bg-primary font-semibold text-white no-underline hover:text-white"
                >
                  Call 800-SAKINA
                </a>
              )}
            </li>
          ))}
        </ol>

        <p className="text-caption text-text-2">
          If you are in danger now, tap &ldquo;I need help now&rdquo;. Your referral, booking and first contact show on{" "}
          <Link href="/check/done/current">your timeline</Link>.
        </p>
      </div>
    </>
  );
}
