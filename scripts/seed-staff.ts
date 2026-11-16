/**
 * Creates (or resets) the three demo staff accounts in Supabase Auth.
 *
 *   npm run seed:staff
 *
 * The role is stored in app_metadata, which only the service role can set.
 * Set DEMO_STAFF_PASSWORD to choose the password; otherwise one is generated
 * and printed once. Demo accounts only: synthetic data.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ACCOUNTS = [
  { email: "clinician@borderless.demo", role: "clinician" },
  { email: "supervisor@borderless.demo", role: "supervisor" },
  { email: "judge@borderless.demo", role: "judge" },
];

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = process.env.DEMO_STAFF_PASSWORD ?? randomBytes(9).toString("base64url");
  const { data: existing, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;

  for (const account of ACCOUNTS) {
    const found = existing.users.find((u) => u.email === account.email);
    const attrs = { password, email_confirm: true, app_metadata: { role: account.role } };
    const { error } = found
      ? await admin.auth.admin.updateUserById(found.id, attrs)
      : await admin.auth.admin.createUser({ email: account.email, ...attrs });
    if (error) throw error;
    console.log(`${found ? "reset  " : "created"} ${account.email} (${account.role})`);
  }
  console.log(`\nPassword for all three: ${password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
