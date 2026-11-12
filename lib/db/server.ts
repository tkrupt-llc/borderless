import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key, which bypasses RLS.
 * Patient pages never talk to Supabase directly: every read and write goes
 * through API routes or server components that use this client.
 *
 * Never import this from a "use client" file. SUPABASE_SERVICE_ROLE_KEY has no
 * NEXT_PUBLIC_ prefix, so Next.js will not ship it to the browser.
 */

let admin: SupabaseClient | undefined;

export function isDbConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function db(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}
