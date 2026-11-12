import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PatientHeader } from "@/components/patient-header";
import { copingIcons } from "@/components/icons";
import cards from "@/content/coping-cards/cards.json";

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
  const card = [...cards.cards, MY_REASONS].find((c) => c.id === id);
  if (!card) notFound();
  const Icon = copingIcons[card.id as keyof typeof copingIcons];

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 px-5 pt-5">
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">{card.title}</h1>
        {card.duration && <p className="text-caption text-muted">{card.duration}</p>}

        {card.id === "breathing" ? (
          <div className="flex justify-center py-6" aria-hidden="true">
            <div className="flex size-48 items-center justify-center rounded-full bg-sage-soft">
              <div className="size-40 animate-[breathe_10s_ease-in-out_infinite] rounded-full bg-sage" />
            </div>
          </div>
        ) : (
          Icon && (
            <div className="flex justify-center py-4">
              <Icon size={96} />
            </div>
          )
        )}

        {/* Card text comes from the psychiatrist's wording doc. */}
        <p className="rounded-2xl bg-surface px-4 py-3.5 text-text-2">[Approved card wording from the psychiatrist]</p>
      </div>
    </>
  );
}
