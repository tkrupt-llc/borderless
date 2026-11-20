import { NextResponse, type NextRequest } from "next/server";
import { getStaff } from "@/lib/staff/auth";
import { findCase } from "@/lib/staff/data";
import { scopeOf } from "@/lib/staff/scope";

// The top-bar search: a case reference goes straight to that case.
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const staff = await getStaff();
  if (!staff) return to("/staff/login");
  const ref = (request.nextUrl.searchParams.get("ref") ?? "").trim().slice(0, 20);
  const ids = await findCase(ref, scopeOf(staff));
  if (ids.length === 1) return to(`/staff/case/${ids[0]}`);
  return to(`/staff?notfound=${encodeURIComponent(ref)}`);
}
