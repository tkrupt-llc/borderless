import Link from "next/link";
import { InfoPage } from "@/components/info-page";

export default function ContactPage() {
  return (
    <InfoPage eyebrow="Contact" title="Get in" em="touch">
      <section className="flex flex-col gap-2">
        <h2>If you are in danger now</h2>
        <p>
          Call 998 (ambulance) or 999 (police), or open <Link href="/help-now">I need help now</Link>. For 24/7 support, call
          800-SAKINA (800 725462).
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Talk to your care team</h2>
        <p>
          Request a call back or send a message from <Link href="/talk">Talk to someone</Link>. Replies show on your
          timeline.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Your data</h2>
        <p>
          See, change or delete what we keep on <Link href="/my-data">See or delete your data</Link>.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>About the prototype</h2>
        <p>
          Borderless was built for the Future Health Digital Innovation Challenge 2026. Feedback about the prototype goes
          through the challenge submission.
        </p>
      </section>
    </InfoPage>
  );
}
