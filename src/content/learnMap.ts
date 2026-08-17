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
  note: string;
}>;

/** Shared copy and diagram data for every surface that teaches how to read a map. */
export const learnMapPages: readonly LearnMapPage[] = Object.freeze([
  {
    id: "impact",
    title: "Start with the Impact",
    eyebrow: "The outcome",
    introduction:
      "Begin at the top with the outcome that mattered, then read downward. Each level answers why the level above happened.",
    cards: [
      { label: "Impact", detail: "Service unavailable", tone: "impact" },
      { label: "Event", detail: "Requests began failing", tone: "event" },
    ],
    connector: "Why?",
    note: "The map is an explanation, not a checklist. Keep asking why while moving down.",
  },
  {
    id: "events",
    title: "Events describe what happened",
    eyebrow: "Observable occurrences",
    introduction:
      "Events sit below the Impact. Follow causal lines to see which occurrence contributed to which outcome.",
    cards: [
      { label: "Event", detail: "Deployment completed", tone: "event" },
      { label: "Event", detail: "Requests began failing", tone: "event" },
    ],
    connector: "contributed to",
    note: "A line states a causal claim. Proximity on the canvas does not.",
  },
  {
    id: "factors",
    title: "Factors explain why",
    eyebrow: "Causal conditions",
    introduction:
      "Factors are findings about conditions that helped produce an Event or Impact. Read each branch downward as another answer to why.",
    cards: [
      { label: "Event", detail: "Requests began failing", tone: "event" },
      {
        label: "Factor",
        detail: "Invalid configuration loaded",
        tone: "factor",
      },
    ],
    connector: "because",
    note: "Branches can show several contributing conditions without forcing a single root cause.",
  },
  {
    id: "controls",
    title: "Controls belong on transitions",
    eyebrow: "Intended safeguards",
    introduction:
      "A Control is placed on the causal transition it was intended to prevent, detect, or mitigate.",
    cards: [
      { label: "Factor", detail: "Invalid configuration", tone: "factor" },
      {
        label: "Control",
        detail: "Configuration validation · Failed",
        tone: "control",
      },
      { label: "Event", detail: "Requests began failing", tone: "event" },
    ],
    connector: "transition",
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
        detail: "Requests failed\nContext: peak traffic increased the effect",
        tone: "event",
      },
      {
        label: "Impact",
        detail:
          "Customers could not check out\nContext: cached sessions reduced the effect",
        tone: "impact",
      },
    ],
    connector: "led to",
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
        detail: "Invalid configuration loaded",
        tone: "factor",
      },
      {
        label: "Evidence",
        detail: "Deployment log and config diff",
        tone: "evidence",
      },
    ],
    connector: "tested by",
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
        detail: "Invalid configuration loaded",
        tone: "factor",
      },
      { label: "Action", detail: "Add schema validation", tone: "action" },
    ],
    connector: "addressed by →",
    note: "This placement preserves the difference between what caused the incident and what the team will do next.",
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
    note: "Sequence can suggest questions, but earlier does not automatically mean causal.",
  },
]);
