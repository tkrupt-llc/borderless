import Link from "next/link";
import { InfoPage } from "@/components/info-page";

// Privacy, written to match how the app actually works: Supabase (Sydney), Vercel (Sydney), Groq only with AI help on.
export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="Privacy" title="Your" em="privacy">
      <p>
        Borderless is a prototype built for the Future Health Digital Innovation Challenge 2026. Please don&apos;t enter
        real names or contact details.
      </p>

      <section className="flex flex-col gap-2">
        <h2>What we store</h2>
        <ul>
          <li>Your answers to the questions, and the scores worked out from them.</li>
          <li>Your chat with the assistant, only if you switch on AI help in the full check-in.</li>
          <li>Your phone number or email and contact preferences, only if you share them.</li>
          <li>Physical health conditions, only if you choose to share them.</li>
          <li>Your choices about sharing, and a log of who opened or changed your case.</li>
        </ul>
        <p>No name or account is needed. Your check-in is linked to this browser by a cookie.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2>Who can see it</h2>
        <ul>
          <li>Only your care team, after signing in to the clinician console.</li>
          <li>Never your employer or university. If you opened the check-in from their website, they only see totals for groups of 10 people or more.</li>
          <li>Your GP, only if you choose &ldquo;Share a summary with my GP&rdquo;. You or your clinician download it; nothing is sent automatically.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2>Where it is processed</h2>
        <ul>
          <li>Your data is stored in a managed database (Supabase) in Sydney, Australia. The website runs on Vercel, also in Sydney.</li>
          <li>
            With AI help switched on, your chat messages are sent to an outside AI service (Groq) so the assistant can ask
            questions. The AI never scores your answers or decides your next step: fixed rules and a clinician do.
          </li>
          <li>A pilot in Abu Dhabi would move hosting to the UAE before any real data is used.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2>Your choices</h2>
        <p>
          You can see what we keep, change any choice, download a GP summary or delete everything at any time on{" "}
          <Link href="/my-data">See or delete your data</Link>. Every change is recorded so your care team knows.
        </p>
        <p>Quick exit leaves the site in one tap and clears this browser&apos;s link to your check-in.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2>If you might be in danger</h2>
        <p>
          If your answers show you might not be safe, the on-call clinician is alerted straight away. If you are in danger
          now, call 998 or 999.
        </p>
      </section>
    </InfoPage>
  );
}
