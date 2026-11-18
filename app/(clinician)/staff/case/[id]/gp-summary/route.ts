import { z } from "zod";
import { requireStaff } from "@/lib/staff/auth";
import { gpSummaryResponse } from "@/lib/fhir/respond";
import { audit } from "@/lib/staff/audit";

// GP summary download for the care team, only with the person's "share with my GP" consent.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const parsed = z.uuid().safeParse((await ctx.params).id);
  if (!parsed.success) return new Response("Not found", { status: 404 });
  const res = await gpSummaryResponse(parsed.data);
  if (res.ok) await audit(staff, "gp_summary_downloaded", "session", parsed.data, parsed.data);
  return res;
}
