import directory from "@/content/directory/services.json";

// The referral directory: Abu Dhabi options. DRAFT details, to be confirmed with each provider.
export type Service = (typeof directory.services)[number];
export const SERVICES: Service[] = directory.services;
export const DIRECTORY_IS_DRAFT = directory.status === "draft";

export function serviceById(id: string | null | undefined): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

/** Services for a care step; all of them when there is no step (urgent pathway, or not decided yet). */
export function servicesForStep(step: number | null): Service[] {
  if (step === null) return SERVICES;
  return SERVICES.filter((s) => s.steps.includes(step));
}
