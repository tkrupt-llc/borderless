/**
 * Creates (or updates) the guest console account: guest@borderless.demo, supervisor rights,
 * app_metadata.demo = true so it only ever sees demo cases (sessions.is_demo).
 *
 * Its password is random and thrown away: guests sign in with "Continue as guest", which makes
 * a one-time sign-in link on the server (app/(clinician)/staff/login/actions.ts).
 *
 *   npx tsx --env-file=.env.local scripts/create-guest.ts
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const GUEST_EMAIL = "guest@borderless.demo";

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const attrs = {
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
    app_metadata: { role: "supervisor", demo: true },
  };
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email === GUEST_EMAIL);
  const { error } = existing
    ? await admin.auth.admin.updateUserById(existing.id, attrs)
    : await admin.auth.admin.createUser({ email: GUEST_EMAIL, ...attrs });
  if (error) throw error;
  console.log(`${existing ? "Updated" : "Created"} ${GUEST_EMAIL} (supervisor, demo cases only).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
