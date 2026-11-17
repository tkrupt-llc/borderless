import data from "@/content/clinics.json";

// Clinics that embed the check-in on their own website (FICTIONAL example in the prototype).
export type Clinic = (typeof data.clinics)[number];
export const CLINIC_COOKIE = "bl_clinic";

export function clinicById(id: string | null | undefined): Clinic | undefined {
  return data.clinics.find((c) => c.id === id);
}
