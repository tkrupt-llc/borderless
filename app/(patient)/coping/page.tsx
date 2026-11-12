import Link from "next/link";
import { PatientHeader } from "@/components/patient-header";
import { HeartIcon, copingIcons } from "@/components/icons";
import cards from "@/content/coping-cards/cards.json";

export default function CopingPage() {
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
          return (
            <li key={card.id}>
              <Link
                href={`/coping/${card.id}`}
                className="flex h-full flex-col gap-1.5 rounded-[18px] bg-surface p-3.5 text-ink no-underline hover:text-ink hover:outline-[1.5px] hover:outline-line"
              >
                <Icon size={40} stroke={2.6} />
                <strong className="text-base font-semibold">{card.shortTitle ?? card.title}</strong>
                <span className="text-small text-muted">{card.duration}</span>
              </Link>
            </li>
          );
        })}
        <li className="col-span-2">
          <Link
            href="/coping/my-reasons"
            className="flex items-center gap-3.5 rounded-[18px] bg-primary px-4 py-3.5 text-white no-underline hover:text-white"
          >
            <HeartIcon size={40} />
            <span className="flex flex-col">
              <strong className="text-base font-semibold">My reasons and next steps</strong>
              <span className="text-small text-on-dark">Your own words, saved for hard moments</span>
            </span>
          </Link>
        </li>
      </ul>
    </>
  );
}
