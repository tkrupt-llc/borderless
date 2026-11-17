"use server";

import { isDbConfigured } from "@/lib/db/server";
import { clearSessionId, readSessionId } from "@/lib/db/patient-session";
import * as persist from "@/lib/check/persist";
import { caseRef } from "@/lib/case-ref";

export type MyDataStatus = { connected: boolean; ref: string | null };

/** Whether this browser holds a check-in, and its reference. */
export async function myDataStatus(): Promise<MyDataStatus> {
  if (!isDbConfigured()) return { connected: false, ref: null };
  try {
    const id = await readSessionId();
    if (!id || !(await persist.getSession(id))) return { connected: true, ref: null };
    return { connected: true, ref: caseRef(id) };
  } catch {
    return { connected: false, ref: null };
  }
}

export async function deleteMyData(): Promise<{ result: "deleted" | "held" | "none" | "error" }> {
  try {
    const id = await readSessionId();
    if (!id || !(await persist.getSession(id))) return { result: "none" };
    const result = await persist.deleteSessionData(id);
    if (result === "deleted") await clearSessionId();
    return { result };
  } catch {
    return { result: "error" };
  }
}
