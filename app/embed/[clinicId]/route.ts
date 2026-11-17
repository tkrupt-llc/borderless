import { NextResponse, type NextRequest } from "next/server";
import { clinicById, CLINIC_COOKIE } from "@/lib/clinics";
import { patientCookie } from "@/lib/db/patient-session";

// Entry point for the check-in embedded on a clinic's website (public/embed.js
// opens this in its side panel). Remembers which clinic it came from, so the
// check-in reaches the care team labelled with that clinic, then starts as usual.
export async function GET(request: NextRequest, ctx: RouteContext<"/embed/[clinicId]">) {
  const { clinicId } = await ctx.params;
  const clinic = clinicById(clinicId);
  if (!clinic) return NextResponse.redirect(new URL("/start", request.url), 303);
  const res = NextResponse.redirect(new URL(`/start?clinic=${encodeURIComponent(clinic.id)}`, request.url), 303);
  res.cookies.set(CLINIC_COOKIE, clinic.id, { ...patientCookie, maxAge: 60 * 60 * 12 });
  return res;
}
