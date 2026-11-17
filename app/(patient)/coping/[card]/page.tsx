import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PatientHeader } from "@/components/patient-header";
import { copingIcons, PhoneIcon } from "@/components/icons";
import cards from "@/content/coping-cards/cards.json";
import { CardStepper, MyReasons } from "./card-parts";
import { category } from "@/lib/coping/categories";

// Card text is the psychiatrist's approved wording (content/coping-cards/cards.json),
// shown word for word, one step per screen.
type Card = (typeof cards.cards)[number] & { message?: string };
const MY_REASONS = { id: "my-reasons", title: cards.myReasons.title, duration: "" };

export function generateStaticParams() {
  return [...cards.cards, MY_REASONS].map((card) => ({ card: card.id }));
}

export default function CopingCardPage({ params, searchParams }: PageProps<"/coping/[card]">) {
  return (
    <>
      <PatientHeader backHref="/coping" />
      <Suspense>
        <CopingCard params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Opened from the crisis screen: the emergency numbers stay on screen (approved writing rule). */
function CrisisNumbers() {
  const call = "flex min-h-12 items-center gap-2.5 rounded-2xl px-4 text-caption font-semibold text-white no-underline hover:text-white";
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <a href="tel:998" className={`${call} bg-danger`}>
        <PhoneIcon />
        Call 998
      </a>
      <a href="tel:800725462" className={`${call} bg-primary`}>
        <PhoneIcon />
        800-SAKINA
      </a>
    </div>
  );
}

async function CopingCard({
  params,
  searchParams,
}: {
  params: PageProps<"/coping/[card]">["params"];
  searchParams: PageProps<"/coping/[card]">["searchParams"];
}) {
  const { card: id } = await params;
  const fromCrisis = (await searchParams).from === "crisis";

  if (id === MY_REASONS.id) {
    const cat = category(cards.myReasons.category);
    return (
      <div className="flex flex-1 flex-col gap-4 px-5 pt-5">
        {fromCrisis && <CrisisNumbers />}
        <div className="flex flex-col gap-1.5 rounded-[22px] p-5" style={{ background: cat.bg }}>
          <span className="text-[0.75rem] font-semibold tracking-[0.04em] uppercase" style={{ color: cat.ink }}>
            {cat.label}
          </span>
          <h1 className="font-serif text-[1.875rem] leading-tight font-normal">{cards.myReasons.title}</h1>
        </div>
        <CardStepper cardId="my-reasons" steps={cards.myReasons.steps} />
        <MyReasons />
      </div>
    );
  }

  const card = cards.cards.find((c) => c.id === id) as Card | undefined;
  if (!card) notFound();
  const Icon = copingIcons[card.id as keyof typeof copingIcons];
  const cat = category(card.category);

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 pt-5">
      {fromCrisis && <CrisisNumbers />}
      {/* Card header in its category colour, with the mechanism in words. */}
      <div className="flex items-start justify-between gap-3 rounded-[22px] p-5" style={{ background: cat.bg }}>
        <div className="flex flex-col gap-1">
          <span className="text-[0.75rem] font-semibold tracking-[0.04em] uppercase" style={{ color: cat.ink }}>
            {cat.label} · {card.duration}
          </span>
          <h1 className="font-serif text-[1.875rem] leading-tight font-normal">{card.title}</h1>
        </div>
        {card.id !== "breathing" && Icon && (
          <span aria-hidden="true">
            <Icon size={56} blob={cat.deep} />
          </span>
        )}
      </div>

      <CardStepper
        cardId={card.id}
        steps={card.steps}
        message={card.message}
        pacer={card.id === "breathing" ? { fill: cat.deep, ring: cat.bg } : undefined}
      />
    </div>
  );
}
