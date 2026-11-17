// Coping cards are colour-coded by what kind of help they give (DESIGN v2,
// "colour by mechanism"). Every card also shows its mechanism as a small
// uppercase label, so colour is never the only signal. Dark text on every tint.
export const CATEGORIES = {
  calm: { label: "Calming", bg: "var(--cat-calm)", deep: "var(--cat-calm-deep)", ink: "var(--cat-calm-ink)" },
  ground: { label: "Grounding", bg: "var(--cat-ground)", deep: "var(--cat-ground-deep)", ink: "var(--cat-ground-ink)" },
  clarity: { label: "Clarity", bg: "var(--cat-clarity)", deep: "var(--cat-clarity-deep)", ink: "var(--cat-clarity-ink)" },
  distress: { label: "Distress tolerance", bg: "var(--cat-distress)", deep: "var(--cat-distress-deep)", ink: "var(--cat-distress-ink)" },
  soothe: { label: "Self-soothing", bg: "var(--cat-soothe)", deep: "var(--cat-soothe-deep)", ink: "var(--cat-soothe-ink)" },
  lift: { label: "Mood lifting", bg: "var(--cat-lift)", deep: "var(--cat-lift-deep)", ink: "var(--cat-lift-ink)" },
  lift2: { label: "Mood lifting", bg: "var(--cat-lift2)", deep: "var(--cat-lift2-deep)", ink: "var(--cat-lift2-ink)" },
} as const;

export type CategoryId = keyof typeof CATEGORIES;

export function category(id: string | undefined) {
  return CATEGORIES[(id ?? "calm") as CategoryId] ?? CATEGORIES.calm;
}
