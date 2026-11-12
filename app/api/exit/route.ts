import { clearSessionId } from "@/lib/db/patient-session";

// Quick exit calls this with navigator.sendBeacon as it leaves, so the
// anonymous session cookie is gone if someone reopens the site on this device.
export async function POST() {
  await clearSessionId();
  return new Response(null, { status: 204 });
}
