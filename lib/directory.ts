import directory from "@/content/directory/services.json";

// The referral directory (FICTIONAL example services in the prototype).
export type Service = (typeof directory.services)[number];
export const SERVICES: Service[] = directory.services;
export const DIRECTORY_IS_EXAMPLE = directory.status === "example";

export function serviceById(id: string | null | undefined): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

/** Services for a care step; all of them when there is no step (urgent pathway, or not decided yet). */
export function servicesForStep(step: number | null): Service[] {
  if (step === null) return SERVICES;
  return SERVICES.filter((s) => s.steps.includes(step));
}
