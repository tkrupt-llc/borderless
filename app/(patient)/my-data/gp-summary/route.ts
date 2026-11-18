import { readSessionId } from "@/lib/db/patient-session";
import { gpSummaryResponse } from "@/lib/fhir/respond";

// The person's own GP summary (FHIR R4). The cookie, never a URL id, decides whose.
export async function GET() {
  const id = await readSessionId();
  if (!id) return new Response("No check-in in this browser.", { status: 404 });
  return gpSummaryResponse(id);
}
