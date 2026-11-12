import { parse } from "yaml";
import { RuleFile } from "@/lib/contracts/rules";
import { allBankFiles } from "@/lib/item-bank";

/**
 * Parses and validates a rule file, then checks every item fact it reads
 * (item.X.n / answer.X.n) names a real item-bank item. A typo such as
 * "answer.ASQ.6" would otherwise never fire and silently miss a red flag.
 */
export function parseRuleFile(yamlText: string): RuleFile {
  const file = RuleFile.parse(parse(yamlText));
  const known = new Set(allBankFiles().flatMap((f) => f.items.map((i) => `${f.instrument}.${i.number}`)));
  for (const fact of factsIn(file)) {
    const m = /^(item|answer)\.(.+)$/.exec(fact);
    if (m && !known.has(m[2])) {
      throw new Error(`${file.ruleset}: fact "${fact}" does not match any item in the item bank`);
    }
  }
  return file;
}

function factsIn(file: RuleFile): string[] {
  const out: string[] = [];
  const walk = (c: unknown) => {
    if (c && typeof c === "object") {
      if ("fact" in c) out.push((c as { fact: string }).fact);
      for (const child of [...((c as { all?: unknown[] }).all ?? []), ...((c as { any?: unknown[] }).any ?? [])]) {
        walk(child);
      }
    }
  };
  file.rules.forEach((r) => walk(r.when));
  return out;
}
