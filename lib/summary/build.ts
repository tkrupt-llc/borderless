import { STEP_NAMES } from "@/lib/rules/routing";

/**
 * Builds the clinician's one-screen summary draft from stored data. No AI call:
 * the AI only supplied the extracted fields, each with its source quote.
 * Order is the approved one (decision #9). A history line without a patient
 * quote is left out, so nothing unquoted reaches the clinician.
 */

export type SummaryInput = {
  fields: { field: string; value: string; quote: string | null }[];
  scores: { instrument: string; total: number; band: string }[];
  redFlags: { ruleId: string; tier: string; trigger: string }[];
  preferences: { language: string | null; clinicianGender: string | null };
  history: { bpd: boolean; adhd: boolean };
  proposal: { step: number | null; urgent: boolean; reasons: string[] } | null;
};

export type SummaryLine = { key: string; label: string; text: string; quote?: string };

const BAND_WORDS: Record<string, string> = {
  minimal: "minimal",
  mild: "mild",
  moderate: "moderate",
  moderately_severe: "moderately severe",
  severe: "severe",
  positive: "positive gate",
  negative: "negative gate",
};
const INSTRUMENT_NAMES: Record<string, string> = { PHQ9: "PHQ-9", GAD7: "GAD-7", PHQ2: "PHQ-2", GAD2: "GAD-2" };

export function buildSummary(input: SummaryInput): SummaryLine[] {
  const lines: SummaryLine[] = [];
  // One line per history field, quoting the patient; several mentions are joined.
  const field = (key: string, label: string) => {
    const quoted = input.fields.filter((f) => f.field === key && f.quote);
    if (quoted.length === 0) return;
    lines.push({
      key,
      label,
      text: [...new Set(quoted.map((f) => f.value))].join("; "),
      quote: quoted.map((f) => f.quote).join(" … "),
    });
  };

  field("presenting_complaint", "Presenting complaint");
  field("duration", "Duration");

  if (input.scores.length > 0) {
    lines.push({
      key: "scores",
      label: "Scores",
      text: input.scores
        .map((s) => `${INSTRUMENT_NAMES[s.instrument] ?? s.instrument} ${s.total} (${BAND_WORDS[s.band] ?? s.band})`)
        .join(", "),
    });
  }

  field("functioning", "Functioning");
  field("sleep", "Sleep");
  field("substances", "Substances");
  field("medical_conditions", "Medical conditions");
  field("medicines", "Medicines");

  // Physical-health prompts (decision #12).
  const text = (key: string) =>
    input.fields
      .filter((f) => f.field === key)
      .map((f) => `${f.value} ${f.quote ?? ""}`)
      .join(" ")
      .toLowerCase();
  const medical = text("medical_conditions");
  const everything = input.fields.map((f) => `${f.value} ${f.quote ?? ""}`).join(" ").toLowerCase();
  const phq9 = input.scores.find((s) => s.instrument === "PHQ9");
  const lowMood = (phq9 && phq9.total >= 10) || input.scores.some((s) => s.instrument === "PHQ2" && s.band === "positive");
  if (/diabet/.test(medical) && (lowMood || /skip\w* (my )?(meals?|tablets?|medic\w*|insulin)/.test(everything))) {
    lines.push({
      key: "physical_prompt",
      label: "Physical health",
      text: "Diabetes with low mood or skipped meals or medicines: consider a physical health review.",
    });
  }
  if (/pregnan|postpartum|post-partum|gave birth|new ?born/.test(everything) && phq9 && phq9.total >= 15) {
    lines.push({
      key: "perinatal_prompt",
      label: "Physical health",
      text: "Pregnant or postpartum with PHQ-9 of 15 or more: consider perinatal mental health review.",
    });
  }

  if (input.redFlags.length > 0) {
    lines.push({
      key: "red_flags",
      label: "Red flags",
      text: input.redFlags.map((r) => `${r.ruleId} (${r.tier})`).join(", "),
    });
  }
  if (input.history.bpd || input.history.adhd) {
    lines.push({
      key: "history",
      label: "Known history",
      text: [input.history.bpd && "BPD", input.history.adhd && "ADHD"].filter(Boolean).join(" and ") + ": extra safeguards on.",
    });
  }

  field("preferences", "Preferences");
  const prefs = [
    input.preferences.language && `language: ${input.preferences.language}`,
    input.preferences.clinicianGender && `clinician: ${input.preferences.clinicianGender}`,
  ].filter(Boolean);
  if (prefs.length > 0) lines.push({ key: "contact_preferences", label: "Contact preferences", text: prefs.join(", ") });

  if (input.proposal) {
    const level = input.proposal.urgent
      ? "Urgent pathway"
      : input.proposal.step !== null
        ? `Step ${input.proposal.step}: ${STEP_NAMES[input.proposal.step]}`
        : null;
    if (level) {
      lines.push({ key: "proposal", label: "Proposed level", text: `${level}. Reasons: ${input.proposal.reasons.join("; ")}.` });
    }
  }
  return lines;
}

export function summaryToText(lines: SummaryLine[]): string {
  return lines.map((l) => `${l.label}: ${l.text}`).join("\n");
}
