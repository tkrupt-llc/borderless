import { z } from "zod";
import { requireStaff } from "@/lib/staff/auth";
import { gpSummaryResponse } from "@/lib/fhir/respond";
import { audit } from "@/lib/staff/audit";
import { scopeOf, sessionInScope } from "@/lib/staff/scope";

// GP summary download for the care team, only with the person's "share with my GP" consent,
// and only for a case in this account's scope (the guest sees demo cases only).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const parsed = z.uuid().safeParse((await ctx.params).id);
  if (!parsed.success || !(await sessionInScope(parsed.data, scopeOf(staff)))) return new Response("Not found", { status: 404 });
  const res = await gpSummaryResponse(parsed.data);
  if (res.ok) await audit(staff, "gp_summary_downloaded", "session", parsed.data, parsed.data);
  return res;
}
