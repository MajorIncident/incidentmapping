export const INVESTIGATION_CONCEPT_IDS = [
  "impact",
  "event",
  "factor",
  "control",
  "context",
  "aggravating-context",
  "mitigating-context",
  "evidence",
  "action",
] as const;

export type InvestigationConceptId = (typeof INVESTIGATION_CONCEPT_IDS)[number];

export type InvestigationConcept = Readonly<{
  id: InvestigationConceptId;
  name: string;
  shortDefinition: string;
  definition: string;
  investigativeQuestion: string;
  examples: readonly string[];
  /** CSS/presentation token; semantic meaning remains in the other fields. */
  visualRole: string;
  relatedConceptIds: readonly InvestigationConceptId[];
}>;

/**
 * Builds an ordered collection and rejects ambiguous IDs at the content boundary.
 * Exported so other generated educational content can use the same validation.
 */
export const createInvestigationConceptCollection = <
  T extends Readonly<{ id: string }>,
>(
  concepts: readonly T[],
): readonly T[] => {
  const seen = new Set<string>();
  for (const concept of concepts) {
    if (seen.has(concept.id)) {
      throw new Error(`Duplicate investigation concept ID: "${concept.id}"`);
    }
    seen.add(concept.id);
  }
  return Object.freeze([...concepts]);
};

export const investigationConcepts =
  createInvestigationConceptCollection<InvestigationConcept>([
    {
      id: "impact",
      name: "Impact",
      shortDefinition: "The outcome or consequence.",
      definition:
        "Harm, loss, disruption, or another material outcome produced by the incident.",
      investigativeQuestion: "What outcome or consequence resulted?",
      examples: ["Injury", "Service interruption", "Financial loss"],
      visualRole: "impact",
      relatedConceptIds: ["event", "mitigating-context", "action"],
    },
    {
      id: "event",
      name: "Event",
      shortDefinition: "Something that occurred.",
      definition:
        "An occurrence at a point or over a period of time; sequence or timing alone does not establish causality.",
      investigativeQuestion: "What occurred?",
      examples: [
        "Alarm activated",
        "Vehicle left the roadway",
        "Operator restarted the pump",
      ],
      visualRole: "event",
      relatedConceptIds: ["impact", "factor", "evidence"],
    },
    {
      id: "factor",
      name: "Factor",
      shortDefinition: "A condition judged to have contributed causally.",
      definition:
        "A condition for which the investigation makes an explicit causal judgment, rather than merely noting a relevant fact.",
      investigativeQuestion: "What condition contributed causally?",
      examples: ["Ambiguous procedure", "Fatigue", "Corroded component"],
      visualRole: "factor",
      relatedConceptIds: ["event", "context", "control"],
    },
    {
      id: "control",
      name: "Control",
      shortDefinition: "An intended safeguard.",
      definition:
        "A preventive, detective, or mitigating safeguard intended to manage an identified causal relationship.",
      investigativeQuestion:
        "What safeguard was intended to prevent, detect, or mitigate this?",
      examples: ["Interlock", "Independent review", "Emergency shutdown"],
      visualRole: "control",
      relatedConceptIds: ["factor", "event", "action"],
    },
    {
      id: "context",
      name: "Context",
      shortDefinition: "A relevant, nondirectional fact.",
      definition:
        "A fact useful to understanding the investigation that is not asserted to cause or change the effect of an occurrence.",
      investigativeQuestion:
        "What relevant fact helps understanding without asserting a causal direction?",
      examples: [
        "Weather was overcast",
        "Site had three shifts",
        "Asset was 12 years old",
      ],
      visualRole: "context",
      relatedConceptIds: [
        "factor",
        "aggravating-context",
        "mitigating-context",
        "evidence",
      ],
    },
    {
      id: "aggravating-context",
      name: "Aggravating Context",
      shortDefinition: "Context that made the outcome worse.",
      definition:
        "A contextual circumstance judged to have increased the severity, extent, or likelihood of the observed effect.",
      investigativeQuestion: "What made the effect worse?",
      examples: [
        "Delayed access for responders",
        "High occupancy",
        "Strong wind",
      ],
      visualRole: "aggravating-context",
      relatedConceptIds: ["context", "impact", "mitigating-context"],
    },
    {
      id: "mitigating-context",
      name: "Mitigating Context",
      shortDefinition: "Context that reduced the effect.",
      definition:
        "A contextual circumstance judged to have reduced the severity, extent, or likelihood of the observed effect.",
      investigativeQuestion: "What reduced the effect?",
      examples: [
        "Low occupancy",
        "Rapid isolation",
        "Favorable wind direction",
      ],
      visualRole: "mitigating-context",
      relatedConceptIds: ["context", "impact", "aggravating-context"],
    },
    {
      id: "evidence",
      name: "Evidence",
      shortDefinition: "Information supporting the investigation.",
      definition:
        "Recorded, observed, or supplied information that supports or challenges a factual or analytical assertion; it is not itself a cause.",
      investigativeQuestion: "What information supports this?",
      examples: ["Interview record", "Photograph", "Telemetry log"],
      visualRole: "evidence",
      relatedConceptIds: ["event", "factor", "context"],
    },
    {
      id: "action",
      name: "Action",
      shortDefinition: "A response to the investigation.",
      definition:
        "An immediate, corrective, or preventive response proposed or undertaken as a result of a finding.",
      investigativeQuestion: "What response should or did follow?",
      examples: [
        "Replace the component",
        "Revise the procedure",
        "Brief affected teams",
      ],
      visualRole: "action",
      relatedConceptIds: ["impact", "factor", "control"],
    },
  ]);

const conceptsById = new Map(
  investigationConcepts.map((concept) => [concept.id, concept]),
);

export const getInvestigationConcept = (id: string): InvestigationConcept => {
  const concept = conceptsById.get(id as InvestigationConceptId);
  if (!concept) throw new Error(`Unknown investigation concept ID: "${id}"`);
  return concept;
};

/** Decision guide from the kind of statement under review to its concept. */
export const investigationDecisionGuide = Object.freeze({
  outcome: "impact",
  occurrence: "event",
  causalCondition: "factor",
  madeWorse: "aggravating-context",
  reducedEffect: "mitigating-context",
  relevantNondirectionalFact: "context",
  intendedSafeguard: "control",
  supportingInformation: "evidence",
  response: "action",
} satisfies Record<string, InvestigationConceptId>);
