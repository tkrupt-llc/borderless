import type { Metadata } from "next";
import { loadRuleFile } from "@/lib/rules/load";
import { LiveDemo } from "./live-demo";

export const metadata: Metadata = {
  title: "Live demo · Borderless",
  description: "Practice data only. One check-in, two views: patient and clinician.",
  robots: { index: false },
};

// The live demo: its own page, separate from the real check-in and not linked
// from the patient flow. The rule files are read here (server) and handed to the
// demo, which runs the real rules in the browser and saves nothing.
export default function DemoPage() {
  const rules = { redFlags: loadRuleFile("red-flags"), bpdAdhd: loadRuleFile("bpd-adhd"), routing: loadRuleFile("routing") };
  return (
    <>
      <div role="note" className="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-x-2 bg-ink px-4 py-2.5 text-center text-[0.9375rem] text-white">
        <strong className="font-semibold">Demo: nothing you enter here is saved.</strong>
        <span>
          If you need help now, call{" "}
          <a href="tel:999" className="font-semibold text-white underline underline-offset-2 hover:text-white">
            999
          </a>{" "}
          /{" "}
          <a href="tel:998" className="font-semibold text-white underline underline-offset-2 hover:text-white">
            998
          </a>
          .
        </span>
      </div>
      <LiveDemo rules={rules} />
    </>
  );
}
