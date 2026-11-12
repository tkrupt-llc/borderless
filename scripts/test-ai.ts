/**
 * Day 1 check: send 5 sample openings to the model and confirm each reply
 * validates against the AI output contract.
 *
 *   npm run test:ai
 *
 * Done when: 5 out of 5 pass. Uses synthetic text only.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { callIntakeModel } from "@/lib/ai/client";
import { buildMessages } from "@/lib/ai/prompt";

const openings = [
  "My chest feels tight all the time and I can't switch off at night.",
  "I've been feeling really low since I moved here for work, I don't enjoy anything anymore.",
  "Honestly I'm not sure why I'm here, my wife said I should talk to someone. I'm sleeping like 3 hours.",
  "I have diabetes and lately I keep skipping my meals and my tablets, I just can't be bothered.",
  "Too much tension yaar, exams coming and my mind is always racing, can't sit still.",
];

async function main() {
  let passed = 0;
  for (const [i, opening] of openings.entries()) {
    const id = `m${i + 1}`;
    const started = Date.now();
    const result = await callIntakeModel(buildMessages([{ id, role: "patient", text: opening }]), new Set([id]));
    const ms = Date.now() - started;

    if (result.ok) {
      passed++;
      console.log(`PASS ${i + 1}/5 (${ms} ms, attempts: ${result.attempts})`);
      console.log(`  reply: ${result.output.reply}`);
      for (const f of result.output.extracted) console.log(`  ${f.field}: ${f.value}  [${f.sourceMessageId}]`);
      if (result.dropped.length) console.log(`  dropped ${result.dropped.length} unsourced field(s)`);
      console.log(`  possibleRiskLanguage: ${result.output.possibleRiskLanguage}`);
    } else {
      console.log(`FAIL ${i + 1}/5 (${ms} ms, attempts: ${result.attempts}): ${result.error}`);
    }
  }
  console.log(`\n${passed}/5 returned valid output from ${process.env.LLM_MODEL}`);
  process.exit(passed === openings.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
