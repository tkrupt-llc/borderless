import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PatientHeader } from "@/components/patient-header";
import { copingIcons } from "@/components/icons";
import cards from "@/content/coping-cards/cards.json";
import { BreathingPacer, CardFeedback, MyReasons, ReachOut } from "./card-parts";

type Card = (typeof cards.cards)[number] & { caution?: string; message?: string };
const MY_REASONS = { id: "my-reasons", title: "My reasons and next steps", duration: "" };

export function generateStaticParams() {
  return [...cards.cards, MY_REASONS].map((card) => ({ card: card.id }));
}

// The header (with Quick exit) is in the instant shell; the card itself reads the
// URL, so it sits behind Suspense.
export default function CopingCardPage({ params }: PageProps<"/coping/[card]">) {
  return (
    <>
      <PatientHeader backHref="/coping" />
      <Suspense>
        <CopingCard params={params} />
      </Suspense>
    </>
  );
}

async function CopingCard({ params }: { params: PageProps<"/coping/[card]">["params"] }) {
  const { card: id } = await params;

  if (id === MY_REASONS.id) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-5 pt-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
            My reasons and <em className="text-primary">next steps</em>
          </h1>
          <p className="text-text-2">Write these down on a calmer day, so they are here when things feel hard.</p>
        </div>
        <MyReasons />
      </div>
    );
  }

  const card = cards.cards.find((c) => c.id === id) as Card | undefined;
  if (!card) notFound();
  const Icon = copingIcons[card.id as keyof typeof copingIcons];

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 pt-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">{card.title}</h1>
        <p className="text-caption text-muted">{card.duration}</p>
        <p className="text-text-2">{card.intro}</p>
      </div>

      {card.id === "breathing" ? (
        <BreathingPacer />
      ) : (
        Icon && (
          <div className="flex justify-center" aria-hidden="true">
            <Icon size={88} blob={cards.cards.findIndex((c) => c.id === card.id) % 2 ? "var(--sky-deep)" : "var(--sage)"} />
          </div>
        )
      )}

      <ol className="flex flex-col gap-2.5">
        {card.steps.map((step, i) => (
          <li key={step} className="flex gap-3.5 rounded-2xl bg-surface px-4 py-3.5">
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-full bg-sage text-caption font-semibold text-text-on-sage"
            >
              {i + 1}
            </span>
            <span className="text-ink">{step}</span>
          </li>
        ))}
      </ol>

      {card.caution && (
        <p className="rounded-2xl border-[1.5px] border-line px-4 py-3 text-caption text-text-2">
          <strong className="font-semibold text-ink">Take care: </strong>
          {card.caution}
        </p>
      )}

      {card.message && <ReachOut message={card.message} />}

      <CardFeedback cardId={card.id} />

      {cards.wordingStatus === "draft" && (
        <p className="text-small text-muted">Draft wording, awaiting clinical approval.</p>
      )}
    </div>
  );
}
