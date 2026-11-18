import { InfoPage } from "@/components/info-page";

export default function TermsPage() {
  return (
    <InfoPage eyebrow="Terms" title="Terms of" em="use">
      <p>
        Borderless is a prototype built for the Future Health Digital Innovation Challenge 2026. It is not a live health
        service.
      </p>
      <section className="flex flex-col gap-2">
        <h2>What it is</h2>
        <ul>
          <li>A non-diagnostic intake and navigation tool: it helps you describe how you are and reach the right support.</li>
          <li>Questionnaire scores are screening scores, not a diagnosis.</li>
          <li>The assistant is AI, not a therapist. It never diagnoses or gives medical advice. A clinician decides your next step.</li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2>What it is not</h2>
        <ul>
          <li>Not an emergency service. If you are in danger now, call 998 (ambulance) or 999 (police).</li>
          <li>Not a replacement for your doctor or for treatment you already have.</li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Using the prototype</h2>
        <ul>
          <li>Please don&apos;t enter real names or contact details.</li>
          <li>The service may change or be unavailable at any time.</li>
          <li>Coping cards and guides were approved by a psychiatrist for this prototype.</li>
        </ul>
      </section>
    </InfoPage>
  );
}
