import "server-only";
import { db } from "@/lib/db/server";
import type { Staff } from "@/lib/staff/auth";

/** One audit line for something a staff member did. */
export async function audit(staff: Staff, action: string, objectType: string, objectId: string, sessionId: string | null, metadata: object = {}) {
  const { error } = await db().from("audit_events").insert({
    actor: `${staff.role}:${staff.id}`, action, object_type: objectType, object_id: objectId, session_id: sessionId, metadata,
  });
  if (error) throw new Error(`audit: ${error.message}`);
}
