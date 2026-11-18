/**
 * Physical health checklist (optional, consented). Self-reported only: never
 * inferred, never shown to the person as a label. SNOMED CT codes are used in
 * the GP summary (FHIR); "other" is free text only.
 */
export const CONDITIONS = [
  { id: "diabetes", label: "Diabetes", snomed: { code: "73211009", display: "Diabetes mellitus" } },
  { id: "heart", label: "Heart condition", snomed: { code: "56265001", display: "Heart disease" } },
  { id: "chronic_pain", label: "Long-term (chronic) pain", snomed: { code: "82423001", display: "Chronic pain" } },
  { id: "pregnancy_postpartum", label: "Pregnant, or had a baby in the last year", snomed: { code: "77386006", display: "Pregnancy" } },
  { id: "long_term_meds", label: "Taking medicines long term", snomed: { code: "182849000", display: "Long-term drug therapy" } },
] as const;
export type ConditionId = (typeof CONDITIONS)[number]["id"];
export const CONDITION_IDS = CONDITIONS.map((c) => c.id) as [ConditionId, ...ConditionId[]];
export const conditionLabel = (id: string) => CONDITIONS.find((c) => c.id === id)?.label ?? id;
