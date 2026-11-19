import { CONDITIONS, snomedFor } from "@/lib/physical-health";
import { may } from "@/lib/consent";

/**
 * GP / primary-care summary as a FHIR R4 "collection" Bundle (download only;
 * sending it to Malaffi, the Abu Dhabi health information exchange, is on the
 * roadmap). Pure, so it is tested without a database. Built only with the
 * person's "share with my GP" consent; physical health is included only with
 * its own consent. Screening scores, never a diagnosis.
 */

export type GpSummaryInput = {
  ref: string;
  createdAt: string;
  consents: Record<string, boolean | undefined>;
  scores: { instrument: string; total: number; band: string }[];
  physicalConditions: string[] | null;
  physicalOther: string | null;
  proposedStep: string | null;
  now?: Date;
};

// LOINC codes for the total scores.
const LOINC: Record<string, { code: string; display: string }> = {
  PHQ9: { code: "44261-6", display: "Patient Health Questionnaire 9 item (PHQ-9) total score [Reported]" },
  PHQ2: { code: "55758-7", display: "Patient Health Questionnaire 2 item (PHQ-2) total score [Reported]" },
  GAD7: { code: "70274-6", display: "Generalized anxiety disorder 7 item (GAD-7) total score [Reported.PHQ]" },
  GAD2: { code: "70272-0", display: "Generalized anxiety disorder 2 item (GAD-2) total score [Reported.PHQ]" },
};

export class ConsentRequired extends Error {}

export function buildGpBundle(input: GpSummaryInput) {
  if (!may.exportToGp(input.consents)) throw new ConsentRequired("No consent to share with a GP");
  const patientRef = "urn:uuid:patient";
  const entry: { fullUrl: string; resource: Record<string, unknown> }[] = [];
  const add = (id: string, resource: Record<string, unknown>) => entry.push({ fullUrl: `urn:uuid:${id}`, resource });

  add("patient", {
    resourceType: "Patient",
    // No name or account: the case reference is the only identifier.
    identifier: [{ system: "urn:borderless:case-ref", value: input.ref }],
  });

  for (const s of input.scores) {
    const loinc = LOINC[s.instrument];
    if (!loinc) continue;
    add(`obs-${s.instrument.toLowerCase()}`, {
      resourceType: "Observation",
      status: "final",
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "survey" }] }],
      code: { coding: [{ system: "http://loinc.org", ...loinc }], text: `${s.instrument} total` },
      subject: { reference: patientRef },
      effectiveDateTime: input.createdAt,
      valueInteger: s.total,
      interpretation: [{ text: s.band.replaceAll("_", " ") }],
      note: [{ text: "Screening score, not a diagnosis." }],
    });
  }

  if (may.sharePhysicalHealth(input.consents)) {
    for (const id of input.physicalConditions ?? []) {
      const c = CONDITIONS.find((x) => x.id === id);
      if (!c) continue;
      add(`cond-${id}`, {
        resourceType: "Condition",
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
        verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "unconfirmed" }] },
        code: (() => {
          const snomed = snomedFor(id);
          return snomed ? { coding: [{ system: "http://snomed.info/sct", ...snomed }], text: c.label } : { text: c.label };
        })(),
        subject: { reference: patientRef },
        note: [{ text: "Self-reported by the patient." }],
      });
    }
    if (input.physicalOther) {
      add("cond-other", {
        resourceType: "Condition",
        verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "unconfirmed" }] },
        code: { text: input.physicalOther },
        subject: { reference: patientRef },
        note: [{ text: "Self-reported by the patient." }],
      });
    }
  }

  if (input.proposedStep) {
    add("service-request", {
      resourceType: "ServiceRequest",
      status: "active",
      intent: "proposal",
      code: { text: `Mental health support: ${input.proposedStep}` },
      subject: { reference: patientRef },
      note: [{ text: "Proposed by fixed routing rules and reviewed by a clinician." }],
    });
  }

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: (input.now ?? new Date()).toISOString(),
    meta: { tag: [{ system: "urn:borderless", code: "screening-summary", display: "Non-diagnostic screening summary" }] },
    entry,
  };
}
