import "server-only";
import { db } from "@/lib/db/server";
import type { Staff } from "@/lib/staff/auth";

/**
 * Which cases a signed-in staff member may see and change.
 *
 * The guest account (app_metadata.demo) works only on demo cases (sessions.is_demo); everyone else
 * works only on real ones. Staff data is read with the service key, which bypasses row-level
 * security, so every staff read and write must pass through this scope.
 */
export type Scope = { readonly demo: boolean };

export const scopeOf = (staff: Staff): Scope => ({ demo: staff.demo });

/** Does this case belong to the scope? Unknown ids are out of scope. */
export async function sessionInScope(sessionId: string, scope: Scope): Promise<boolean> {
  const { data, error } = await db().from("sessions").select("is_demo").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(`scope: ${error.message}`);
  return data !== null && data.is_demo === scope.demo;
}

/** The case a task belongs to, if that case is in scope. */
export async function taskSessionInScope(taskId: string, scope: Scope): Promise<string | null> {
  const { data, error } = await db().from("tasks").select("session_id, sessions!inner(is_demo)").eq("id", taskId).maybeSingle();
  if (error) throw new Error(`scope: ${error.message}`);
  const row = data as { session_id: string; sessions: { is_demo: boolean } } | null;
  return row && row.sessions.is_demo === scope.demo ? row.session_id : null;
}

/** Every case id in the scope, for filtering aggregate reads (insights, outcomes). */
export async function sessionIdsInScope(scope: Scope): Promise<Set<string>> {
  const { data, error } = await db().from("sessions").select("id").eq("is_demo", scope.demo).limit(50000);
  if (error) throw new Error(`scope: ${error.message}`);
  return new Set((data ?? []).map((r: { id: string }) => r.id));
}
