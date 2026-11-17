// Coping cards are colour-coded by what kind of help they give, so people can
// find the right one quickly. Every card also shows its category in words.
export const CATEGORIES = {
  calm: { label: "Calming", bg: "var(--cat-calm)", deep: "var(--cat-calm-deep)" },
  ground: { label: "Grounding", bg: "var(--cat-ground)", deep: "var(--cat-ground-deep)" },
  distress: { label: "Riding out distress", bg: "var(--cat-distress)", deep: "var(--cat-distress-deep)" },
  soothe: { label: "Self-soothing", bg: "var(--cat-soothe)", deep: "var(--cat-soothe-deep)" },
  lift: { label: "Connecting and lifting", bg: "var(--cat-lift)", deep: "var(--cat-lift-deep)" },
  clarity: { label: "Pausing to think", bg: "var(--cat-clarity)", deep: "var(--cat-clarity-deep)" },
} as const;

export type CategoryId = keyof typeof CATEGORIES;

export function category(id: string | undefined) {
  return CATEGORIES[(id ?? "calm") as CategoryId] ?? CATEGORIES.calm;
}
