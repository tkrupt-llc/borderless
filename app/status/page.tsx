import { Suspense } from "react";
import { connection } from "next/server";
import { db, isDbConfigured } from "@/lib/db/server";

// Developer check: proves the deployed app can reach the database.

async function DatabaseStatus() {
  await connection(); // read the database on every request, not at build time
  let status: string;
  if (!isDbConfigured()) {
    status = "Database not configured: set the Supabase keys.";
  } else {
    // Not head:true: a HEAD request has no error body, so a missing table would look like "0".
    const { count, error } = await db().from("sessions").select("id", { count: "exact" }).limit(1);
    status = error ? `Database error: ${error.message}` : `Database connected. Sessions stored: ${count ?? 0}.`;
  }
  return <p className="rounded-2xl bg-surface px-4 py-3 text-caption">{status}</p>;
}

export default function StatusPage() {
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center gap-4 px-5 py-12">
      <h1 className="font-serif text-[1.875rem] font-normal">Status</h1>
      <p>Prototype. Synthetic data only.</p>
      <Suspense fallback={<p className="text-caption text-muted">Checking the database…</p>}>
        <DatabaseStatus />
      </Suspense>
    </main>
  );
}
