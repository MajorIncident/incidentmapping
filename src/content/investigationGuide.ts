import type { InvestigationConceptId } from "./investigationModel";

export type GuideContext =
  | "empty-map"
  | "new-map"
  | "impact-selected"
  | "event-selected"
  | "factor-selected"
  | "action-selected"
  | "control-selected"
  | "evidence-selected"
  | "context-editing"
  | "chronology"
  | "presentation"
  | "missing-impact"
  | "missing-events"
  | "missing-factors"
  | "missing-controls"
  | "missing-evidence"
  | "missing-root-cause"
  | "missing-actions"
  | "multiple-branches"
  | "assertion-state";

export type GuideContentBlock =
  | Readonly<{ type: "paragraph"; text: string }>
  | Readonly<{ type: "bullets"; items: readonly string[] }>
  | Readonly<{ type: "question"; text: string }>
  | Readonly<{ type: "callout"; tone: "info" | "caution"; text: string }>;

export type GuideVisual = Readonly<{
  kind: "icon" | "diagram" | "illustration";
  source: string;
  alt: string;
}>;

export type GuideAction = Readonly<{
  id: string;
  label: string;
  intent: "create" | "edit" | "navigate" | "review";
}>;

export type GuideEntry = Readonly<{
  id: string;
  contexts: readonly GuideContext[];
  title: string;
  content: readonly GuideContentBlock[];
  visual?: GuideVisual;
  suggestedActions: readonly GuideAction[];
  relatedConcepts: readonly InvestigationConceptId[];
  priority: number;
  dismissible: boolean;
  whyThisTip: string;
}>;

const entry = (
  id: string,
  contexts: readonly GuideContext[],
  title: string,
  text: string,
  priority: number,
  relatedConcepts: readonly InvestigationConceptId[],
): GuideEntry => ({
  id,
  contexts,
  title,
  content: [{ type: "paragraph", text }],
  suggestedActions: [],
  relatedConcepts,
  priority,
  dismissible: true,
  whyThisTip: `Shown because ${text.charAt(0).toLowerCase()}${text.slice(1)}`,
});

/** Stable array order is the secondary ranking key after priority. */
export const investigationGuide: readonly GuideEntry[] = Object.freeze([
  entry(
    "empty-map",
    ["empty-map"],
    "Start the story",
    "the map has no entities yet.",
    100,
    ["impact", "event"],
  ),
  entry(
    "new-map",
    ["new-map"],
    "Develop the new map",
    "the map was newly created.",
    95,
    ["impact", "event"],
  ),
  entry(
    "context-editing",
    ["context-editing"],
    "Describe context carefully",
    "Context is being edited; keep causal claims as Factors.",
    90,
    ["context", "factor"],
  ),
  entry(
    "chronology",
    ["chronology"],
    "Check the sequence",
    "Chronology is active; compare timestamps without assuming causation.",
    88,
    ["event", "evidence"],
  ),
  entry(
    "presentation",
    ["presentation"],
    "Review the story",
    "presentation mode is active.",
    86,
    ["impact", "event", "factor"],
  ),
  entry(
    "assertion-state",
    ["assertion-state"],
    "Test the assertion",
    "the selection is not yet Confirmed.",
    84,
    ["factor", "evidence"],
  ),
  entry(
    "event-no-factors",
    ["event-selected"],
    "Explore contributing Factors",
    "the selected Event has no child Factors.",
    82,
    ["event", "factor"],
  ),
  entry(
    "impact-selected",
    ["impact-selected"],
    "Describe the Impact",
    "an Impact is selected.",
    60,
    ["impact"],
  ),
  entry(
    "event-selected",
    ["event-selected"],
    "Describe the Event",
    "an Event is selected.",
    60,
    ["event"],
  ),
  entry(
    "factor-selected",
    ["factor-selected"],
    "Test the Factor",
    "a Factor is selected.",
    60,
    ["factor", "evidence"],
  ),
  entry(
    "action-selected",
    ["action-selected"],
    "Make the Action specific",
    "an Action is selected.",
    60,
    ["action"],
  ),
  entry(
    "control-selected",
    ["control-selected"],
    "Assess the Control",
    "a Control is selected.",
    60,
    ["control", "evidence"],
  ),
  entry(
    "evidence-selected",
    ["evidence-selected"],
    "Check the Evidence",
    "Evidence is selected.",
    60,
    ["evidence"],
  ),
  entry(
    "multiple-branches",
    ["multiple-branches"],
    "Compare branches",
    "the causal story has multiple branches.",
    55,
    ["event", "factor"],
  ),
  ...(
    [
      "impact",
      "events",
      "factors",
      "controls",
      "evidence",
      "root-cause",
      "actions",
    ] as const
  ).map((name) =>
    entry(
      `missing-${name}`,
      [`missing-${name}` as GuideContext],
      `Add ${name.replace("-", " ")}`,
      `the investigation has no ${name.replace("-", " ")} yet.`,
      40,
      name === "root-cause"
        ? ["factor"]
        : [name.replace(/s$/, "") as InvestigationConceptId],
    ),
  ),
]);

export const investigationGuideEntries = investigationGuide;
