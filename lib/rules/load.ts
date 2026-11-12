import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseRuleFile } from "./parse";
import type { RuleFile } from "@/lib/contracts/rules";

// Rule files are read on the server only. next.config.ts traces content/ into the
// deployment. A rule file that fails its contract stops the app loudly.
export type RuleFileName = "red-flags" | "bpd-adhd";
const cache = new Map<RuleFileName, RuleFile>();

export function loadRuleFile(name: RuleFileName): RuleFile {
  const hit = cache.get(name);
  if (hit) return hit;
  const raw = readFileSync(path.join(process.cwd(), "content", "rules", `${name}.yaml`), "utf8");
  const file = parseRuleFile(raw);
  cache.set(name, file);
  return file;
}
