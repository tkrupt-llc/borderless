import Link from "next/link";
import { InfoPage } from "@/components/info-page";

export default function AccessibilityPage() {
  return (
    <InfoPage eyebrow="Accessibility" title="Accessible to" em="everyone">
      <p>We aim to meet WCAG 2.2 level AA. This is what we do today, and what we know is missing.</p>
      <section className="flex flex-col gap-2">
        <h2>What we do</h2>
        <ul>
          <li>One question per page, in plain English, with large tap targets.</li>
          <li>Body text of at least 17 pixels, and text colours that meet contrast guidelines.</li>
          <li>Works with a keyboard and screen readers; every button and chart has a text label.</li>
          <li>Animations stop if your device is set to reduce motion.</li>
          <li>&ldquo;I need help now&rdquo; and &ldquo;Talk to someone&rdquo; are in the same place on every page.</li>
          <li>Key pages are checked with automated accessibility tests (axe) before each release.</li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2>What&apos;s missing</h2>
        <ul>
          <li>English only for now. Arabic is planned, with right-to-left layout already supported.</li>
          <li>No audio or sign-language version yet.</li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Tell us about a problem</h2>
        <p>
          If something doesn&apos;t work for you, see <Link href="/contact">Contact</Link>.
        </p>
      </section>
    </InfoPage>
  );
}
