import {
  getInvestigationConcept,
  type InvestigationConceptId,
} from "./investigationModel";

export const GUIDE_CONTEXTS = [
  "empty-map",
  "new-map",
  "impact-selected",
  "event-selected",
  "factor-selected",
  "action-selected",
  "control-selected",
  "evidence-selected",
  "context-editing",
  "chronology",
  "presentation",
  "missing-impact",
  "missing-events",
  "missing-factors",
  "missing-controls",
  "missing-evidence",
  "missing-root-cause",
  "missing-actions",
  "multiple-branches",
  "assertion-state",
  "maturity-building-story",
  "maturity-analyzing-causes",
  "maturity-testing-findings",
  "maturity-planning-actions",
  "maturity-ready-to-review",
] as const;

export type GuideContext = (typeof GUIDE_CONTEXTS)[number];

export const GUIDE_ACTION_IDS = [
  "add-impact",
  "add-event",
  "add-factor",
  "add-control",
  "add-aggravating-context",
  "add-mitigating-context",
  "add-evidence",
  "link-existing-evidence",
  "add-action",
  "open-chronology",
  "review-assertion",
  "open-presentation",
  "review-checklist",
] as const;

export type GuideActionId = (typeof GUIDE_ACTION_IDS)[number];

/** Semantic blocks let every guide surface choose an accessible presentation. */
export type GuideContentBlock =
  | Readonly<{ type: "heading"; text: string; level: 2 | 3 }>
  | Readonly<{ type: "body"; text: string }>
  | Readonly<{ type: "example"; label: string; text: string }>
  | Readonly<{ type: "rule"; text: string }>
  | Readonly<{ type: "question"; text: string }>
  | Readonly<{
      type: "suggested-action";
      actionId: GuideActionId;
      text: string;
    }>
  | Readonly<{ type: "warning"; text: string }>
  | Readonly<{ type: "keyboard-hint"; keys: readonly string[]; text: string }>
  | Readonly<{
      type: "mini-diagram";
      nodes: readonly string[];
      connectors: readonly string[];
      /** A complete text alternative; diagrams must never convey meaning only visually. */
      alt: string;
    }>;

export type GuideAction = Readonly<{
  id: GuideActionId;
  label: string;
  intent: "create" | "edit" | "navigate" | "review";
}>;

export type GuideEntry = Readonly<{
  id: string;
  contexts: readonly GuideContext[];
  title: string;
  /** Kept deliberately short for the primary tip. */
  content: readonly GuideContentBlock[];
  /** Optional teaching material shown only after disclosure. */
  detail?: readonly GuideContentBlock[];
  suggestedActions: readonly GuideAction[];
  relatedConcepts: readonly InvestigationConceptId[];
  priority: number;
  dismissible: boolean;
  whyThisTip: string;
}>;

const concept = getInvestigationConcept;
const action = (
  id: GuideActionId,
  label: string,
  intent: GuideAction["intent"] = "create",
): GuideAction => ({ id, label, intent });
const body = (text: string): GuideContentBlock => ({ type: "body", text });
const question = (id: InvestigationConceptId): GuideContentBlock => ({
  type: "question",
  text: concept(id).investigativeQuestion,
});
const example = (id: InvestigationConceptId, index = 0): GuideContentBlock => ({
  type: "example",
  label: `${concept(id).name} example`,
  text: concept(id).examples[index],
});
const diagram = (
  nodes: readonly string[],
  connectors: readonly string[],
  alt: string,
): GuideContentBlock => ({ type: "mini-diagram", nodes, connectors, alt });
const makeEntry = (
  entry: Omit<GuideEntry, "dismissible" | "whyThisTip"> & {
    why: string;
  },
): GuideEntry => ({
  ...entry,
  dismissible: true,
  whyThisTip: `Shown because ${entry.why}`,
});

/** Stable array order is the secondary ranking key after priority. */
export const investigationGuide: readonly GuideEntry[] = Object.freeze([
  makeEntry({
    id: "new-map",
    contexts: ["empty-map", "new-map"],
    title: "Start with Impact",
    content: [body(concept("impact").shortDefinition), question("impact")],
    detail: [
      { type: "heading", level: 3, text: "Begin at the outcome" },
      body(concept("impact").definition),
      example("impact"),
      diagram(["Impact"], [], "One Impact begins the investigation map."),
      {
        type: "suggested-action",
        actionId: "add-impact",
        text: "Add the outcome first.",
      },
    ],
    suggestedActions: [action("add-impact", "Add Impact")],
    relatedConcepts: ["impact"],
    priority: 100,
    why: "the map is empty or newly created.",
  }),
  makeEntry({
    id: "selected-impact",
    contexts: ["impact-selected"],
    title: "Clarify this Impact",
    content: [question("impact"), example("impact", 1)],
    detail: [
      body(concept("impact").definition),
      {
        type: "rule",
        text: "Record the outcome here; record what occurred as Events.",
      },
    ],
    suggestedActions: [action("add-event", "Add Event")],
    relatedConcepts: ["impact", "event"],
    priority: 60,
    why: "an Impact is selected.",
  }),
  makeEntry({
    id: "selected-event",
    contexts: ["event-selected"],
    title: "Place the Event",
    content: [
      question("event"),
      diagram(
        ["Impact", "Event"],
        ["←"],
        "An Event connects causally toward an Impact.",
      ),
    ],
    detail: [
      body(concept("event").definition),
      example("event"),
      {
        type: "rule",
        text: "Sequence and timing alone do not prove causation.",
      },
    ],
    suggestedActions: [action("add-factor", "Add Factor")],
    relatedConcepts: ["event", "factor"],
    priority: 62,
    why: "an Event is selected.",
  }),
  makeEntry({
    id: "edit-event-context",
    contexts: ["context-editing"],
    title: "Classify the context",
    content: [question("context")],
    detail: [
      body(concept("context").definition),
      example("context"),
      {
        type: "rule",
        text: "If the fact contributed causally, capture it as a Factor instead.",
      },
      {
        type: "keyboard-hint",
        keys: ["Escape"],
        text: "Press Escape to finish editing.",
      },
    ],
    suggestedActions: [],
    relatedConcepts: [
      "context",
      "factor",
      "aggravating-context",
      "mitigating-context",
    ],
    priority: 90,
    why: "Event Context is being edited.",
  }),
  makeEntry({
    id: "selected-factor",
    contexts: ["factor-selected"],
    title: "Test the causal claim",
    content: [question("factor")],
    detail: [
      body(concept("factor").definition),
      example("factor"),
      {
        type: "suggested-action",
        actionId: "add-evidence",
        text: "Attach information that supports or challenges the claim.",
      },
    ],
    suggestedActions: [action("add-evidence", "Add Evidence")],
    relatedConcepts: ["factor", "evidence"],
    priority: 60,
    why: "a Factor is selected.",
  }),
  makeEntry({
    id: "selected-control",
    contexts: ["control-selected"],
    title: "Assess the intended safeguard",
    content: [question("control")],
    detail: [
      body(concept("control").definition),
      example("control"),
      {
        type: "rule",
        text: `A ${concept("control").name} is intended to mitigate risk; incident-specific circumstances that reduced the effect are ${concept("mitigating-context").name}.`,
      },
    ],
    suggestedActions: [action("add-evidence", "Add Evidence")],
    relatedConcepts: ["control", "mitigating-context", "evidence"],
    priority: 60,
    why: "a Control is selected.",
  }),
  makeEntry({
    id: "add-aggravating-context",
    contexts: ["impact-selected", "event-selected"],
    title: "What made it worse?",
    content: [question("aggravating-context")],
    detail: [
      body(concept("aggravating-context").definition),
      example("aggravating-context"),
      diagram(
        ["Context", "Effect"],
        ["increased →"],
        "Aggravating Context increased the observed effect.",
      ),
    ],
    suggestedActions: [
      action("add-aggravating-context", "Add Aggravating Context"),
    ],
    relatedConcepts: ["aggravating-context", "impact"],
    priority: 48,
    why: "an outcome or occurrence is selected.",
  }),
  makeEntry({
    id: "add-mitigating-context",
    contexts: ["impact-selected", "event-selected"],
    title: "What reduced the effect?",
    content: [question("mitigating-context")],
    detail: [
      body(concept("mitigating-context").definition),
      example("mitigating-context"),
      {
        type: "rule",
        text: `Use ${concept("control").name} for an intended safeguard; use ${concept("mitigating-context").name} for what actually reduced this incident's effect.`,
      },
      diagram(
        ["Context", "Effect"],
        ["reduced →"],
        "Mitigating Context reduced the observed effect.",
      ),
    ],
    suggestedActions: [
      action("add-mitigating-context", "Add Mitigating Context"),
    ],
    relatedConcepts: ["mitigating-context", "control", "impact"],
    priority: 47,
    why: "an outcome or occurrence is selected.",
  }),
  makeEntry({
    id: "create-evidence",
    contexts: ["evidence-selected", "missing-evidence"],
    title: "Connect Evidence to a finding",
    content: [
      {
        type: "warning",
        text: "Evidence supports a finding but is not itself a Factor.",
      },
      question("evidence"),
    ],
    detail: [
      body(concept("evidence").definition),
      example("evidence"),
      {
        type: "suggested-action",
        actionId: "link-existing-evidence",
        text: "Use Link Existing when the same Evidence supports multiple entities.",
      },
    ],
    suggestedActions: [
      action("add-evidence", "Add Evidence"),
      action("link-existing-evidence", "Link Existing", "edit"),
    ],
    relatedConcepts: ["evidence", "factor"],
    priority: 65,
    why: "Evidence is selected or missing.",
  }),
  makeEntry({
    id: "selected-action",
    contexts: ["action-selected"],
    title: "Make the response specific",
    content: [question("action")],
    detail: [
      body(concept("action").definition),
      example("action"),
      {
        type: "rule",
        text: "State an owner, outcome, and review point where known.",
      },
    ],
    suggestedActions: [],
    relatedConcepts: ["action", "factor", "control"],
    priority: 60,
    why: "an Action is selected.",
  }),
  makeEntry({
    id: "chronology",
    contexts: ["chronology"],
    title: "Check sequence, then causality",
    content: [
      { type: "rule", text: "Compare timestamps without assuming causation." },
    ],
    detail: [
      body(concept("event").definition),
      diagram(
        ["Earlier Event", "Later Event"],
        ["time →"],
        "An earlier Event precedes a later Event; this does not by itself show causation.",
      ),
    ],
    suggestedActions: [
      action("open-chronology", "Open Chronology", "navigate"),
    ],
    relatedConcepts: ["event", "evidence"],
    priority: 88,
    why: "Chronology is active.",
  }),
  makeEntry({
    id: "assertion-state",
    contexts: ["assertion-state"],
    title: "Make confidence visible",
    content: [
      {
        type: "question",
        text: "What supports or challenges this assertion state?",
      },
    ],
    detail: [
      {
        type: "rule",
        text: "Advance the state only when the finding has appropriate support and review.",
      },
      {
        type: "suggested-action",
        actionId: "review-assertion",
        text: "Review the assertion and its linked Evidence.",
      },
    ],
    suggestedActions: [
      action("review-assertion", "Review Assertion", "review"),
    ],
    relatedConcepts: ["factor", "evidence", "control"],
    priority: 84,
    why: "the selected assertion is not Confirmed.",
  }),
  makeEntry({
    id: "presentation",
    contexts: ["presentation"],
    title: "Present the supported story",
    content: [
      body(
        "Check that the outcome, sequence, findings, and responses are clear.",
      ),
    ],
    detail: [
      {
        type: "question",
        text: "Can a reviewer distinguish observations, causal judgments, and supporting information?",
      },
      {
        type: "warning",
        text: "Presentation simplifies the view; it does not replace investigation review.",
      },
    ],
    suggestedActions: [
      action("open-presentation", "Review Presentation", "navigate"),
    ],
    relatedConcepts: ["impact", "event", "factor", "evidence", "action"],
    priority: 86,
    why: "Presentation mode is active.",
  }),
  ...(
    [
      [
        "building-story",
        "Build the incident story",
        "Capture Impact, Events, and Factors.",
        ["impact", "event", "factor"],
      ],
      [
        "analyzing-causes",
        "Analyze the causes",
        "Test Factors and identify the root cause finding.",
        ["factor", "evidence"],
      ],
      [
        "testing-findings",
        "Test the findings",
        "Assess Controls and connect Evidence.",
        ["control", "evidence"],
      ],
      [
        "planning-actions",
        "Plan the response",
        "Connect specific Actions to supported findings.",
        ["action", "factor"],
      ],
      [
        "ready-to-review",
        "Ready for review",
        "Review the complete story without treating the checklist as proof.",
        ["impact", "evidence", "action"],
      ],
    ] as const
  ).map(([id, title, text, related], index) =>
    makeEntry({
      id: `maturity-${id}`,
      contexts: [`maturity-${id}` as GuideContext],
      title,
      content: [body(text)],
      detail: [
        {
          type: "question",
          text: "What remains uncertain, unsupported, or unassigned?",
        },
      ],
      suggestedActions: [
        action("review-checklist", "Review Checklist", "review"),
      ],
      relatedConcepts: related,
      priority: 30 - index,
      why: `the investigation is in the ${title.toLowerCase()} stage.`,
    }),
  ),
]);

export const investigationGuideEntries = investigationGuide;
