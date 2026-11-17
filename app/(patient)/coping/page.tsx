import { Backdrop } from "@/components/backdrop";
import Link from "next/link";
import { PatientHeader } from "@/components/patient-header";
import { HeartIcon, copingIcons } from "@/components/icons";
import cards from "@/content/coping-cards/cards.json";
import { category } from "@/lib/coping/categories";

// The seven approved core coping cards, colour-coded by the kind of help they
// give; each card also names its mechanism in words.
export default function CopingPage() {
  const reasons = category(cards.myReasons.category);
  return (
    <>
      <PatientHeader />
      <Backdrop side="right" />

      <div className="flex flex-col gap-1.5 px-5 pt-5">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          Coping <em className="text-primary">cards</em>
        </h1>
        <p className="text-base text-text-2">Pick one. There&apos;s no wrong choice. Colours show what each card helps with.</p>
      </div>

      <ul className="grid auto-rows-fr grid-cols-2 gap-2.5 px-5 py-4">
        {cards.cards.map((card) => {
          const Icon = copingIcons[card.id as keyof typeof copingIcons];
          const cat = category(card.category);
          return (
            <li key={card.id}>
              <Link
                href={`/coping/${card.id}`}
                style={{ background: cat.bg }}
                className="tap flex h-full flex-col gap-1.5 rounded-[18px] p-3.5 text-ink no-underline hover:text-ink hover:outline-[1.5px] hover:outline-line"
              >
                <Icon size={40} stroke={2.6} blob={cat.deep} />
                <span className="text-[0.75rem] font-semibold tracking-[0.04em] uppercase" style={{ color: cat.ink }}>
                  {cat.label}
                </span>
                <strong className="text-base font-semibold">{card.title}</strong>
                <span className="text-small text-muted">{card.duration}</span>
              </Link>
            </li>
          );
        })}
        <li className="col-span-2">
          <Link
            href="/coping/my-reasons"
            style={{ background: reasons.bg }}
            className="tap flex items-center gap-3.5 rounded-[18px] px-4 py-3.5 text-ink no-underline hover:text-ink hover:outline-[1.5px] hover:outline-line"
          >
            <HeartIcon size={40} blob={reasons.deep} color="var(--ink)" />
            <span className="flex flex-col">
              <span className="text-[0.75rem] font-semibold tracking-[0.04em] uppercase" style={{ color: reasons.ink }}>
                {reasons.label}
              </span>
              <strong className="text-base font-semibold">My reasons and next steps</strong>
              <span className="text-small text-text-2">Your own words, saved for hard moments</span>
            </span>
          </Link>
        </li>
      </ul>
      <div className="px-5 pb-4">
        <Link href="/guides" className="inline-flex min-h-11 items-center text-caption text-primary-dark underline underline-offset-2">
          Self-help guides: sleep, worry, breathing
        </Link>
      </div>

    </>
  );
}
