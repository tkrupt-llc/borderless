import Link from "next/link";
import { PatientHeader } from "@/components/patient-header";
import { HeartIcon, copingIcons } from "@/components/icons";
import cards from "@/content/coping-cards/cards.json";
import { CATEGORIES, category, type CategoryId } from "@/lib/coping/categories";

// Cards are colour-coded by the kind of help they give; the category is also
// written on each card, and a key below explains the colours.
export default function CopingPage() {
  const reasons = category(cards.myReasonsCategory);
  const used = [...new Set([...cards.cards.map((c) => c.category), cards.myReasonsCategory])] as CategoryId[];
  return (
    <>
      <PatientHeader />

      <div className="flex flex-col gap-1.5 px-5 pt-5">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
          Coping <em className="text-primary">cards</em>
        </h1>
        <p className="text-base text-text-2">Pick one. There&apos;s no wrong choice.</p>
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
                className="flex h-full flex-col gap-1.5 rounded-[18px] p-3.5 text-ink no-underline hover:text-ink hover:outline-[1.5px] hover:outline-line"
              >
                <Icon size={40} stroke={2.6} blob={cat.deep} />
                <strong className="text-base font-semibold">{card.shortTitle ?? card.title}</strong>
                <span className="text-small text-text-2">
                  {cat.label} · {card.duration}
                </span>
              </Link>
            </li>
          );
        })}
        <li className="col-span-2">
          <Link
            href="/coping/my-reasons"
            style={{ background: reasons.bg }}
            className="flex items-center gap-3.5 rounded-[18px] px-4 py-3.5 text-ink no-underline hover:text-ink hover:outline-[1.5px] hover:outline-line"
          >
            <HeartIcon size={40} blob={reasons.deep} color="var(--ink)" />
            <span className="flex flex-col">
              <strong className="text-base font-semibold">My reasons and next steps</strong>
              <span className="text-small text-text-2">{reasons.label} · your own words, saved for hard moments</span>
            </span>
          </Link>
        </li>
      </ul>

      <section aria-labelledby="key-h" className="flex flex-col gap-2 px-5 pb-4">
        <h2 id="key-h" className="text-caption font-semibold text-text-2">
          What the colours mean
        </h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-small text-text-2">
          {used.map((id) => (
            <li key={id} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3 rounded-full" style={{ background: CATEGORIES[id].deep }} />
              {CATEGORIES[id].label}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
