import { NextResponse, type NextRequest } from "next/server";
import { getStaff } from "@/lib/staff/auth";
import { findCase } from "@/lib/staff/data";

// The top-bar search: a case reference goes straight to that case.
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  if (!(await getStaff())) return to("/staff/login");
  const ref = (request.nextUrl.searchParams.get("ref") ?? "").trim().slice(0, 20);
  const ids = await findCase(ref);
  if (ids.length === 1) return to(`/staff/case/${ids[0]}`);
  return to(`/staff?notfound=${encodeURIComponent(ref)}`);
}
