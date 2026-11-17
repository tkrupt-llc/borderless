import Link from "next/link";
import { PhoneIcon } from "@/components/icons";

const call = "flex min-h-[56px] items-center gap-3.5 rounded-2xl px-[18px] text-white no-underline hover:text-white";

/**
 * After the safety questions. No scores are shown; the person is told plainly
 * who has their answers and what to do while they wait.
 */
export function SafetyDone({ positive }: { positive: boolean }) {
  return (
    <div className="flex flex-col gap-4 px-5 pt-5">
      <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
        Thank you for <em className="text-primary">telling us</em>
      </h1>
      <p className="text-text-2">
        {positive
          ? "The on-call clinician has your answers and has been alerted. They will contact you as soon as they can."
          : "Your answers are with your care team. If things change, come back to this page at any time."}
      </p>

      <div className="flex flex-col gap-2.5">
        <a href="tel:998" className={`${call} bg-danger`}>
          <PhoneIcon />
          <span className="flex flex-col">
            <strong className="font-semibold">If you are in danger now, call 998</strong>
            <span className="text-small text-[#FBE9E7]">Ambulance</span>
          </span>
        </a>
        <a href="tel:800725462" className={`${call} bg-primary`}>
          <PhoneIcon />
          <span className="flex flex-col">
            <strong className="font-semibold">Talk to someone now: 800-SAKINA</strong>
            <span className="text-small text-on-dark">800 725462 · 24/7 support</span>
          </span>
        </a>
      </div>

      <section aria-labelledby="wait-h" className="rounded-2xl bg-sky px-4 py-3.5">
        <h2 id="wait-h" className="font-semibold">
          While you wait
        </h2>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 ps-5 text-caption text-text-2">
          <li>Stay with someone you trust, or let someone know how you feel.</li>
          <li>Move away from anything you could use to hurt yourself.</li>
          <li>
            Try <Link href="/coping/breathing">paced breathing</Link> or <Link href="/coping/tip">TIP</Link>.
          </li>
        </ul>
      </section>
    </div>
  );
}
