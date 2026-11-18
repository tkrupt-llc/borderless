import "server-only";
import * as persist from "@/lib/check/persist";
import { caseRef } from "@/lib/case-ref";
import { buildGpBundle, ConsentRequired } from "./bundle";

/** The GP summary as a FHIR R4 JSON download, or 403 without the person's consent. */
export async function gpSummaryResponse(sessionId: string): Promise<Response> {
  const data = await persist.loadGpSummaryData(sessionId);
  if (!data) return new Response("Not found", { status: 404 });
  try {
    const bundle = buildGpBundle({ ref: caseRef(sessionId), ...data });
    return new Response(JSON.stringify(bundle, null, 2), {
      headers: {
        "content-type": "application/fhir+json; charset=utf-8",
        "content-disposition": `attachment; filename="gp-summary-${caseRef(sessionId)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ConsentRequired) return new Response("Sharing with a GP is switched off for this check-in.", { status: 403 });
    throw e;
  }
}
