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
  "first-event-draft",
  "multiple-branches",
  "assertion-state",
  "maturity-getting-started",
  "maturity-building-the-story",
  "maturity-exploring-causes",
  "maturity-developing-findings",
  "maturity-planning-response",
  "maturity-reviewing-the-investigation",
] as const;

export type GuideContext = (typeof GUIDE_CONTEXTS)[number];

export const GUIDE_ACTION_IDS = [
  "add-impact",
  "add-event",
  "add-factor",
  "add-control",
  "add-context",
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
    title: "STEP 1 · START HERE",
    content: [
      { type: "heading", level: 3, text: "Name the Impact" },
      question("impact"),
      ...concept("impact").examples.map(
        (text): GuideContentBlock => ({
          type: "example",
          label: "Example",
          text,
        }),
      ),
      { type: "rule", text: "Describe the outcome, not the cause." },
    ],
    suggestedActions: [],
    relatedConcepts: ["impact"],
    priority: 100,
    why: "the map is empty or newly created.",
  }),
  makeEntry({
    id: "selected-impact",
    contexts: ["impact-selected", "first-event-draft"],
    title: "STEP 2 · WHAT HAPPENED?",
    content: [
      {
        type: "question",
        text: "What happened immediately before the outcome?",
      },
    ],
    suggestedActions: [action("add-event", "+ Add Event")],
    relatedConcepts: ["impact", "event"],
    priority: 60,
    why: "an Impact is selected.",
  }),
  makeEntry({
    id: "selected-event",
    contexts: ["event-selected"],
    title: "STEP 3 · ASK WHY",
    content: [
      { type: "question", text: "Why did this happen?" },
      diagram(
        ["Event — something happened", "Factor — a condition existed"],
        ["or"],
        "Choose Event when something happened. Choose Factor when a condition existed.",
      ),
    ],
    suggestedActions: [
      action("add-event", "+ Event"),
      action("add-factor", "+ Factor"),
    ],
    relatedConcepts: ["event", "factor"],
    priority: 62,
    why: "an Event is selected.",
  }),
  makeEntry({
    id: "edit-event-context",
    contexts: ["context-editing"],
    title: "Does this belong in the causal chain?",
    content: [
      {
        type: "question",
        text: "Choose Factor when it contributed causally; otherwise classify how the Context changed the outcome.",
      },
    ],
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
    suggestedActions: [
      action("add-factor", "Factor"),
      action("add-aggravating-context", "Aggravating Context"),
      action("add-mitigating-context", "Mitigating Context"),
      action("add-context", "Context"),
    ],
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
    title: "ASK WHY",
    content: [
      { type: "question", text: "Why did this condition exist?" },
      body(
        "Continue the line of inquiry when another contributing condition is useful.",
      ),
    ],
    suggestedActions: [action("add-factor", "+ Factor")],
    relatedConcepts: ["factor"],
    priority: 60,
    why: "a Factor is selected.",
  }),
  makeEntry({
    id: "selected-control",
    contexts: ["control-selected"],
    title: "CHECK THE SAFEGUARD",
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
        ["Effect", "Aggravating Context"],
        ["made worse by ↓"],
        "Read top down: the Effect was made worse by Aggravating Context.",
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
        ["Effect", "Mitigating Context"],
        ["reduced by ↓"],
        "Read top down: the Effect was reduced by Mitigating Context.",
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
    contexts: ["evidence-selected"],
    title: "SUPPORT THE FINDING",
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
    title: "PLAN THE RESPONSE",
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
        ["followed in time by ↓"],
        "Read top down: an Earlier Event is followed in time by a Later Event; this does not by itself show causation.",
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
        "getting-started",
        "Getting started",
        "Orient the investigation around its impact and the first known work.",
        ["impact"],
      ],
      [
        "building-the-story",
        "Build the incident story",
        "Capture Impact, Events, and Factors.",
        ["impact", "event", "factor"],
      ],
      [
        "exploring-causes",
        "Explore causes",
        "Explore Factors without requiring a single Root Cause label.",
        ["factor", "evidence"],
      ],
      [
        "developing-findings",
        "Develop findings",
        "Assess Controls and connect Evidence.",
        ["control", "evidence"],
      ],
      [
        "planning-response",
        "Plan the response",
        "Connect specific Actions to supported findings.",
        ["action", "factor"],
      ],
      [
        "reviewing-the-investigation",
        "Review the investigation",
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
