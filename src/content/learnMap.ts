export type LearnMapCard = Readonly<{
  label: string;
  detail: string;
  tone:
    | "impact"
    | "event"
    | "factor"
    | "control"
    | "evidence"
    | "action"
    | "context";
}>;

export type LearnMapPage = Readonly<{
  id: string;
  title: string;
  eyebrow: string;
  introduction: string;
  cards: readonly LearnMapCard[];
  connector?: string;
  /** Complete reading-order alternative for the teaching diagram. */
  diagramAlt: string;
  note: string;
}>;

/** Shared copy and diagram data for every surface that teaches how to read a map. */
export const learnMapPages: readonly LearnMapPage[] = Object.freeze([
  {
    id: "impact",
    title: "Start with an Impact",
    eyebrow: "The outcome",
    introduction:
      "Impact means an outcome that mattered. An investigation can contain multiple Impacts when one incident produced more than one material outcome. Read downward from each outcome to understand why it happened.",
    cards: [
      { label: "Impact", detail: "Delivery arrived late", tone: "impact" },
      { label: "Event", detail: "Vehicle departed late", tone: "event" },
    ],
    connector: "Why?",
    diagramAlt:
      "Impact: Delivery arrived late. Why? Event: Vehicle departed late.",
    note: "Each Impact is top-level. The map is an explanation, not a checklist; keep asking why while moving down.",
  },
  {
    id: "events",
    title: "Events describe what happened",
    eyebrow: "Observable occurrences",
    introduction:
      "Events sit below the Impact. Follow causal lines to see which occurrence contributed to which outcome.",
    cards: [
      { label: "Event", detail: "Vehicle departed late", tone: "event" },
      { label: "Event", detail: "Delivery arrived late", tone: "event" },
    ],
    connector: "contributed to",
    diagramAlt:
      "Event: Vehicle departed late. This contributed to the Event: Delivery arrived late.",
    note: "A line states a causal claim. Proximity on the canvas does not.",
  },
  {
    id: "factors",
    title: "Factors explain why",
    eyebrow: "Causal conditions",
    introduction:
      "Factors are findings about conditions that helped produce an Event or Impact. Read each branch downward as another answer to why.",
    cards: [
      { label: "Event", detail: "Vehicle departed late", tone: "event" },
      {
        label: "Factor",
        detail: "Handover was incomplete",
        tone: "factor",
      },
    ],
    connector: "because",
    diagramAlt:
      "Event: Vehicle departed late, because of the Factor: Handover was incomplete.",
    note: "Branches can show several contributing conditions without forcing a single root cause.",
  },
  {
    id: "controls",
    title: "Controls belong on transitions",
    eyebrow: "Intended safeguards",
    introduction:
      "A Control is placed on the causal transition it was intended to prevent, detect, or mitigate.",
    cards: [
      { label: "Event", detail: "Vehicle departed late", tone: "event" },
      {
        label: "Control",
        detail: "Dispatch verification · Failed",
        tone: "control",
      },
      { label: "Factor", detail: "Handover was incomplete", tone: "factor" },
    ],
    connector: "transition",
    diagramAlt:
      "Top-down transition: Event, Vehicle departed late; Control, Dispatch verification, Failed; Factor, Handover was incomplete.",
    note: "Its position explains where the safeguard should have changed the outcome—not merely when it ran.",
  },
  {
    id: "context",
    title: "Context stays inside the finding",
    eyebrow: "Relevant circumstances",
    introduction:
      "Context appears inside an Event or Impact when it helps explain that finding without making a separate causal claim.",
    cards: [
      {
        label: "Event",
        detail:
          "Vehicle departed late\nAggravating Context: severe weather increased the delay",
        tone: "event",
      },
      {
        label: "Impact",
        detail:
          "Delivery arrived late\nMitigating Context: a backup vehicle reduced the delay",
        tone: "impact",
      },
    ],
    connector: "led to",
    diagramAlt:
      "Event: Vehicle departed late, with Aggravating Context: severe weather increased the delay. This led to the Impact: Delivery arrived late, with Mitigating Context: a backup vehicle reduced the delay.",
    note: "If the circumstance caused the outcome, model it as a Factor instead.",
  },
  {
    id: "evidence",
    title: "Evidence tests findings",
    eyebrow: "Support and challenge",
    introduction:
      "Evidence is attached to the finding it supports or challenges. It strengthens the claim without becoming another cause.",
    cards: [
      {
        label: "Factor",
        detail: "Handover was incomplete",
        tone: "factor",
      },
      {
        label: "Evidence",
        detail: "Dispatch record",
        tone: "evidence",
      },
    ],
    connector: "tested by",
    diagramAlt:
      "Factor: Handover was incomplete. This finding is tested by Evidence: Dispatch record.",
    note: "Ask what information would change your confidence in the finding.",
  },
  {
    id: "actions",
    title: "Actions sit beside findings",
    eyebrow: "The response",
    introduction:
      "Actions branch beside the Event, Factor, or Control they address. They do not continue the causal chain.",
    cards: [
      {
        label: "Factor",
        detail: "Handover was incomplete",
        tone: "factor",
      },
      {
        label: "Action",
        detail: "Revise the handover process",
        tone: "action",
      },
    ],
    connector: "addressed by →",
    diagramAlt:
      "Factor: Handover was incomplete. It is addressed by the Action: Revise the handover process. The Action sits beside the finding, outside the causal chain.",
    note: "This placement preserves the difference between what caused the incident and what the team will do next.",
  },
  {
    id: "classification",
    title: "Where does this information belong?",
    eyebrow: "Classification decisions",
    introduction:
      "Ask what the information says before placing it. The classification words below—not color or position—identify where each statement belongs.",
    cards: [
      {
        label: "Event",
        detail: "What occurred? Vehicle departed late.",
        tone: "event",
      },
      {
        label: "Factor",
        detail: "What condition contributed causally? Handover was incomplete.",
        tone: "factor",
      },
      {
        label: "Aggravating Context",
        detail: "What made the effect worse? Severe weather.",
        tone: "context",
      },
      {
        label: "Mitigating Context",
        detail: "What reduced the effect? A backup vehicle.",
        tone: "context",
      },
      {
        label: "Context",
        detail:
          "What relevant fact helps understanding without asserting a causal direction? The route served three delivery sites.",
        tone: "context",
      },
      {
        label: "Control",
        detail:
          "What safeguard was intended to prevent, detect, or mitigate this? Dispatch verification.",
        tone: "control",
      },
      {
        label: "Evidence",
        detail: "What information supports this? The dispatch record.",
        tone: "evidence",
      },
      {
        label: "Action",
        detail:
          "What response should or did follow? Revise the handover process.",
        tone: "action",
      },
    ],
    diagramAlt:
      "Eight classification decisions: Event—what occurred; Factor—what condition contributed causally; Aggravating Context—what made the effect worse; Mitigating Context—what reduced the effect; Context—what relevant fact helps understanding without asserting causal direction; Control—what intended safeguard applied; Evidence—what information supports the finding; Action—what response should or did follow.",
    note: "Every card names its classification and its deciding question so the choices remain clear without color or connecting lines.",
  },
  {
    id: "presenting",
    title: "Present the story, not the canvas",
    eyebrow: "Guided review",
    introduction:
      "Start at the Impact, follow causal lines downward, and use branches to tell the evidence-backed story. Use chronology separately for timing.",
    cards: [
      {
        label: "Chronology",
        detail: "What happened first and next",
        tone: "context",
      },
      {
        label: "Causality",
        detail: "What contributed to what—and why",
        tone: "factor",
      },
    ],
    connector: "is not",
    diagramAlt:
      "Chronology answers what happened first and next. It is not causality, which answers what contributed to what and why.",
    note: "Sequence can suggest questions, but earlier does not automatically mean causal.",
  },
]);
