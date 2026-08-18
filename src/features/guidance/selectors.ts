import type {
  GuideContext,
  GuideEntry,
} from "../../content/investigationGuide";
import { investigationGuide } from "../../content/investigationGuide";
import type { PresentationLens } from "../presentation/selectors";
import type { MapSession } from "../../state/useAppStore";

export type GuidanceMode =
  | "Onboarding"
  | "Selection"
  | "Task"
  | "Stage"
  | "Review";
export type GuidanceNode = Readonly<{
  id: string;
  title?: string;
  nodeType?: "Impact" | "Event" | "Factor" | "Action";
  evidenceIds?: readonly string[];
  factorSignificance?: string;
  assertionState?: string;
}>;
export type GuidanceEdge = Readonly<{
  source?: string;
  target?: string;
  fromId?: string;
  toId?: string;
  kind?: string;
}>;
export type GuidanceControl = Readonly<{
  id: string;
  evidenceIds?: readonly string[];
  assertionState?: string;
}>;
export type GuidanceEvidence = Readonly<{ id: string }>;
export type SelectedEntity =
  | Readonly<{
      id: string;
      kind?: "node" | "control" | "evidence";
      nodeType?: GuidanceNode["nodeType"];
      assertionState?: string;
    }>
  | string
  | null;
export type GuidanceInput = Readonly<{
  selectedEntity?: SelectedEntity;
  nodes?: readonly GuidanceNode[];
  edges?: readonly GuidanceEdge[];
  controls?: readonly GuidanceControl[];
  evidence?: readonly GuidanceEvidence[];
  actions?: readonly GuidanceNode[];
  presentation?: boolean;
  chronology?: boolean;
  activeLens?: PresentationLens | string | null;
  contextEditing?: boolean;
  eligibleControlRelationshipCount?: number;
  mapSession?: Readonly<MapSession>;
  activeTask?: GuideContext | null;
}>;

export type InvestigationStage =
  | "Getting Started"
  | "Building the Story"
  | "Exploring Causes"
  | "Developing Findings"
  | "Planning Response"
  | "Reviewing the Investigation";
export type ChecklistConcept =
  | "Impact"
  | "Events"
  | "Factors"
  | "Controls"
  | "Evidence"
  | "Root Cause"
  | "Actions";
export type AdvisoryState =
  | "Identified"
  | "Consider"
  | "Not yet explored"
  | "None identified";
export type ChecklistItem = Readonly<{
  concept: ChecklistConcept;
  state: AdvisoryState;
  reason: string;
}>;
export type GuidanceMatch = Readonly<{
  entry: GuideEntry;
  context: GuideContext;
  reason: string;
  mode: GuidanceMode;
}>;
export type GuidanceResult = Readonly<{
  mode: GuidanceMode;
  contexts: readonly GuideContext[];
  matches: readonly GuidanceMatch[];
  primary: GuidanceMatch | null;
  stage: InvestigationStage;
  checklist: readonly ChecklistItem[];
}>;

const selection = (input: GuidanceInput) => {
  const id =
    typeof input.selectedEntity === "string"
      ? input.selectedEntity
      : input.selectedEntity?.id;
  return {
    id,
    node:
      input.nodes?.find((item) => item.id === id) ??
      input.actions?.find((item) => item.id === id),
    control: input.controls?.find((item) => item.id === id),
    evidence: input.evidence?.find((item) => item.id === id),
    supplied:
      typeof input.selectedEntity === "object" && input.selectedEntity
        ? input.selectedEntity
        : undefined,
  };
};

export const deriveInvestigationChecklist = (
  input: GuidanceInput,
): readonly ChecklistItem[] => {
  const nodes = [
    ...(input.nodes ?? []),
    ...(input.actions ?? []).filter(
      (a) => !(input.nodes ?? []).some((n) => n.id === a.id),
    ),
  ];
  const count = (type: GuidanceNode["nodeType"]) =>
    nodes.filter((node) => node.nodeType === type).length;
  const facts: Array<[ChecklistConcept, number, string]> = [
    [
      "Impact",
      count("Impact"),
      "Consider identifying the consequences that frame the investigation.",
    ],
    [
      "Events",
      count("Event"),
      "Not yet explored: events that describe what happened.",
    ],
    [
      "Factors",
      count("Factor"),
      "Not yet explored: conditions or influences worth examining.",
    ],
    [
      "Controls",
      input.controls?.length ?? 0,
      "None identified; consider relevant safeguards when useful.",
    ],
    [
      "Evidence",
      input.evidence?.length ?? 0,
      "None identified; consider support for important assertions.",
    ],
    [
      "Root Cause",
      nodes.filter(
        (n) => n.nodeType === "Factor" && n.factorSignificance === "RootCause",
      ).length,
      "None identified. A Root Cause label is optional, never mandatory.",
    ],
    [
      "Actions",
      count("Action"),
      "None identified; consider a response when findings support one.",
    ],
  ];
  return facts.map(([concept, value, advice]) => ({
    concept,
    state: value
      ? "Identified"
      : concept === "Impact"
        ? "Consider"
        : concept === "Events" || concept === "Factors"
          ? "Not yet explored"
          : "None identified",
    reason: value ? `${concept} identified in the investigation.` : advice,
  }));
};

export const deriveInvestigationStage = (
  input: GuidanceInput,
): InvestigationStage => {
  const nodes = [...(input.nodes ?? []), ...(input.actions ?? [])];
  const selected = selection(input);
  const has = (type: GuidanceNode["nodeType"]) =>
    nodes.some((node) => node.nodeType === type);
  if (!nodes.length && !input.controls?.length && !input.evidence?.length)
    return "Getting Started";
  if (
    has("Impact") &&
    has("Event") &&
    has("Factor") &&
    has("Action") &&
    Boolean(input.controls?.length || input.evidence?.length)
  )
    return "Reviewing the Investigation";
  if (selected.node?.nodeType === "Action" || has("Action"))
    return "Planning Response";
  if (
    selected.control ||
    selected.evidence ||
    input.controls?.length ||
    input.evidence?.length
  ) {
    return "Developing Findings";
  }
  if (selected.node?.nodeType === "Factor" || has("Factor"))
    return "Exploring Causes";
  return "Building the Story";
};

const stageContext = (stage: InvestigationStage): GuideContext =>
  `maturity-${stage.toLowerCase().replaceAll(" ", "-")}` as GuideContext;

export const selectInvestigationGuidance = (
  input: GuidanceInput,
): GuidanceResult => {
  const nodes = input.nodes ?? [],
    edges = input.edges ?? [],
    selected = selection(input);
  const signals: Array<{
    context: GuideContext;
    reason: string;
    mode: GuidanceMode;
  }> = [];
  const add = (context: GuideContext, reason: string, mode: GuidanceMode) => {
    if (!signals.some((item) => item.context === context))
      signals.push({ context, reason, mode });
  };
  // Explicit router lanes keep teaching tied to current domain and UI state.
  if (input.activeTask)
    add(input.activeTask, "An investigation task is currently active.", "Task");
  if (input.contextEditing)
    add("context-editing", "Context is currently being edited.", "Task");
  if (input.chronology || input.activeLens === "Chronology")
    add("chronology", "Chronology is active.", "Task");
  if (input.mapSession?.source === "New" && input.mapSession.fresh)
    add("new-map", "This map was newly created.", "Onboarding");
  const type = selected.node?.nodeType ?? selected.supplied?.nodeType;
  if (type) {
    const firstEventIsDraft =
      type === "Event" &&
      selected.node?.title === "New Event" &&
      nodes.filter((node) => node.nodeType === "Event").length === 1;
    if (firstEventIsDraft) {
      add("first-event-draft", "The first Event is being named.", "Onboarding");
    }
    const context = `${type.toLowerCase()}-selected` as GuideContext;
    const childFactors =
      type === "Event" &&
      edges.some(
        (edge) =>
          (edge.source ?? edge.fromId) === selected.id &&
          nodes.find((node) => node.id === (edge.target ?? edge.toId))
            ?.nodeType === "Factor",
      );
    if (!firstEventIsDraft)
      add(
        context,
        type === "Event" && !childFactors
          ? "The selected Event has no child Factors."
          : `A${type === "Impact" || type === "Action" ? "n" : ""} ${type} is selected.`,
        "Selection",
      );
  } else if (selected.control || selected.supplied?.kind === "control")
    add("control-selected", "A Control is selected.", "Selection");
  else if (selected.evidence || selected.supplied?.kind === "evidence")
    add("evidence-selected", "Evidence is selected.", "Selection");
  const assertion =
    selected.node?.assertionState ??
    selected.control?.assertionState ??
    selected.supplied?.assertionState;
  if (assertion && assertion !== "Confirmed")
    add(
      "assertion-state",
      `The selected assertion is ${assertion}, not Confirmed.`,
      "Selection",
    );
  const causalOut = new Map<string, number>();
  edges
    .filter((edge) => edge.kind !== "ActionEdge")
    .forEach((edge) => {
      const id = edge.source ?? edge.fromId;
      if (id) causalOut.set(id, (causalOut.get(id) ?? 0) + 1);
    });
  if ([...causalOut.values()].some((count) => count > 1))
    add(
      "multiple-branches",
      "The causal graph contains multiple branches.",
      "Stage",
    );
  const stage = deriveInvestigationStage(input);
  const mature = stage === "Reviewing the Investigation";
  // A mature, unselected map moves beyond stage coaching into review.
  if (!(mature && !selected.id))
    add(
      stageContext(stage),
      `The investigation is oriented toward ${stage}.`,
      "Stage",
    );
  if (input.presentation || (mature && !selected.id))
    add(
      "presentation",
      input.presentation
        ? "Presentation mode is active."
        : "The mature investigation is ready for a no-selection review.",
      "Review",
    );
  const rank: Record<GuidanceMode, number> = {
    Task: 0,
    Onboarding: 1,
    Selection: 2,
    Stage: 3,
    Review: 4,
  };
  const matches = signals
    .flatMap((signal) =>
      investigationGuide.flatMap((entry, order) =>
        entry.contexts.includes(signal.context)
          ? [
              {
                entry,
                context: signal.context,
                reason: signal.reason,
                mode: signal.mode,
                order,
              },
            ]
          : [],
      ),
    )
    .sort(
      (a, b) =>
        rank[a.mode] - rank[b.mode] ||
        b.entry.priority - a.entry.priority ||
        a.order - b.order,
    )
    .map(({ order: _order, ...match }) => {
      if (match.mode !== "Selection" || !type) return match;
      const actions = [...match.entry.suggestedActions];
      if (
        ["Impact", "Event", "Factor"].includes(type) &&
        !actions.some((item) => item.id === "add-action")
      )
        actions.push({ id: "add-action", label: "+ Action", intent: "create" });
      if (
        (type === "Event" || type === "Factor") &&
        input.eligibleControlRelationshipCount &&
        !actions.some((item) => item.id === "add-control")
      )
        actions.push({
          id: "add-control",
          label: "+ Control",
          intent: "create",
        });
      const advisory =
        type === "Factor" &&
        (selected.node?.factorSignificance === "RootCause" ||
          selected.node?.factorSignificance === "KeyFactor")
          ? [
              {
                type: "question" as const,
                text: "What will change? An Action is optional; add one only when the finding supports a response.",
              },
            ]
          : [];
      return {
        ...match,
        entry: {
          ...match.entry,
          content: [...match.entry.content, ...advisory],
          suggestedActions: actions,
        },
      };
    });
  const primary = matches[0] ?? null;
  return {
    mode: primary?.mode ?? "Stage",
    contexts: signals.map((item) => item.context),
    matches,
    primary,
    stage,
    checklist: deriveInvestigationChecklist(input),
  };
};

export const selectGuidance = selectInvestigationGuidance;
