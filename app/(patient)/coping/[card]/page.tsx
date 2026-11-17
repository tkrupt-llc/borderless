import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PatientHeader } from "@/components/patient-header";
import { copingIcons } from "@/components/icons";
import cards from "@/content/coping-cards/cards.json";
import { BreathingPacer, CardFeedback, MyReasons, ReachOut } from "./card-parts";
import { category } from "@/lib/coping/categories";

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
    const cat = category(cards.myReasonsCategory);
    return (
      <div className="flex flex-1 flex-col gap-4 px-5 pt-5">
        <div className="flex flex-col gap-1.5 rounded-[22px] p-5" style={{ background: cat.bg }}>
          <span className="text-[0.75rem] font-semibold tracking-[0.04em] uppercase" style={{ color: cat.ink }}>
            {cat.label}
          </span>
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
  const cat = category(card.category);

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 pt-5">
      {/* Card header in its category colour, with the category in words. */}
      <div className="flex flex-col gap-3 rounded-[22px] p-5" style={{ background: cat.bg }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[0.75rem] font-semibold tracking-[0.04em] uppercase" style={{ color: cat.ink }}>
              {cat.label} · {card.duration}
            </span>
            <h1 className="font-serif text-[1.875rem] leading-tight font-normal">{card.title}</h1>
          </div>
          {card.id !== "breathing" && Icon && (
            <span aria-hidden="true">
              <Icon size={64} blob={cat.deep} />
            </span>
          )}
        </div>
        <p className="text-text-2">{card.intro}</p>
        {card.id === "breathing" && <BreathingPacer fill={cat.deep} ring="rgba(255,255,255,0.6)" />}
      </div>

      <ol className="flex flex-col gap-2.5">
        {card.steps.map((step, i) => (
          <li key={step} className="flex gap-3.5 rounded-2xl bg-surface px-4 py-3.5">
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-full text-caption font-semibold text-ink"
              style={{ background: cat.deep }}
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
