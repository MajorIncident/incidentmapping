import type {
  GuideContext,
  GuideEntry,
} from "../../content/investigationGuide";
import { investigationGuide } from "../../content/investigationGuide";
import type { PresentationLens } from "../presentation/selectors";

export type GuidanceNode = Readonly<{
  id: string;
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
  newlyCreated?: boolean;
}>;

export type InvestigationStage =
  | "Building Story"
  | "Analyzing Causes"
  | "Testing Findings"
  | "Planning Actions"
  | "Ready to Review";
export type ChecklistConcept =
  | "Impact"
  | "Events"
  | "Factors"
  | "Controls"
  | "Evidence"
  | "Root Cause"
  | "Actions";
export type ChecklistItem = Readonly<{
  concept: ChecklistConcept;
  complete: boolean;
  reason: string;
}>;
export type GuidanceMatch = Readonly<{
  entry: GuideEntry;
  context: GuideContext;
  reason: string;
}>;
export type GuidanceResult = Readonly<{
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
  const node =
    input.nodes?.find((item) => item.id === id) ??
    input.actions?.find((item) => item.id === id);
  const control = input.controls?.find((item) => item.id === id);
  const evidence = input.evidence?.find((item) => item.id === id);
  return {
    id,
    node,
    control,
    evidence,
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
  const controls = input.controls ?? [];
  const evidence = input.evidence ?? [];
  const count = (type: GuidanceNode["nodeType"]) =>
    nodes.filter((node) => node.nodeType === type).length;
  const rootCauses = nodes.filter(
    (node) =>
      node.nodeType === "Factor" && node.factorSignificance === "RootCause",
  ).length;
  const facts: Array<[ChecklistConcept, number, string]> = [
    ["Impact", count("Impact"), "No Impact has been recorded."],
    ["Events", count("Event"), "No Events have been recorded."],
    ["Factors", count("Factor"), "No Factors have been recorded."],
    ["Controls", controls.length, "No Controls have been assessed."],
    ["Evidence", evidence.length, "No Evidence has been recorded."],
    ["Root Cause", rootCauses, "No Factor is marked as Root Cause."],
    ["Actions", count("Action"), "No Actions have been planned."],
  ];
  return facts.map(([concept, value, missing]) => ({
    concept,
    complete: value > 0,
    reason:
      value > 0 ? `${concept} is represented in the investigation.` : missing,
  }));
};

export const deriveInvestigationStage = (
  input: GuidanceInput,
): InvestigationStage => {
  const done = new Map(
    deriveInvestigationChecklist(input).map((item) => [
      item.concept,
      item.complete,
    ]),
  );
  if (!done.get("Impact") || !done.get("Events") || !done.get("Factors"))
    return "Building Story";
  if (!done.get("Root Cause")) return "Analyzing Causes";
  if (!done.get("Evidence") || !done.get("Controls")) return "Testing Findings";
  if (!done.get("Actions")) return "Planning Actions";
  return "Ready to Review";
};

export const selectInvestigationGuidance = (
  input: GuidanceInput,
): GuidanceResult => {
  const nodes = input.nodes ?? [],
    edges = input.edges ?? [],
    selected = selection(input);
  const contexts: GuideContext[] = [];
  const reasons = new Map<GuideContext, string>();
  const add = (context: GuideContext, reason: string) => {
    if (!reasons.has(context)) {
      contexts.push(context);
      reasons.set(context, reason);
    }
  };
  if (!nodes.length && !input.actions?.length && !input.controls?.length)
    add("empty-map", "The map has no entities.");
  if (input.newlyCreated) add("new-map", "This map was newly created.");
  if (input.contextEditing)
    add("context-editing", "Context is currently being edited.");
  if (input.chronology || input.activeLens === "Chronology")
    add("chronology", "Chronology is active.");
  if (input.presentation) add("presentation", "Presentation mode is active.");
  const type = selected.node?.nodeType ?? selected.supplied?.nodeType;
  if (type) {
    const context = `${type.toLowerCase()}-selected` as GuideContext;
    const childFactors =
      type === "Event" &&
      edges.some(
        (edge) =>
          (edge.source ?? edge.fromId) === selected.id &&
          nodes.find((n) => n.id === (edge.target ?? edge.toId))?.nodeType ===
            "Factor",
      );
    add(
      context,
      type === "Event" && !childFactors
        ? "The selected Event has no child Factors."
        : `A${type === "Impact" || type === "Action" ? "n" : ""} ${type} is selected.`,
    );
  } else if (selected.control || selected.supplied?.kind === "control")
    add("control-selected", "A Control is selected.");
  else if (selected.evidence || selected.supplied?.kind === "evidence")
    add("evidence-selected", "Evidence is selected.");
  const assertion =
    selected.node?.assertionState ??
    selected.control?.assertionState ??
    selected.supplied?.assertionState;
  if (assertion && assertion !== "Confirmed")
    add(
      "assertion-state",
      `The selected assertion is ${assertion}, not Confirmed.`,
    );
  const causalOut = new Map<string, number>();
  edges
    .filter((e) => e.kind !== "ActionEdge")
    .forEach((e) => {
      const id = e.source ?? e.fromId;
      if (id) causalOut.set(id, (causalOut.get(id) ?? 0) + 1);
    });
  if ([...causalOut.values()].some((value) => value > 1))
    add("multiple-branches", "The causal graph contains multiple branches.");
  deriveInvestigationChecklist(input)
    .filter((item) => !item.complete)
    .forEach((item) =>
      add(
        `missing-${item.concept.toLowerCase().replace(" ", "-")}` as GuideContext,
        item.reason,
      ),
    );
  const maturityContext = `maturity-${deriveInvestigationStage(input)
    .toLowerCase()
    .replaceAll(" ", "-")}` as GuideContext;
  add(
    maturityContext,
    `The investigation is in the ${deriveInvestigationStage(input)} stage.`,
  );
  const matches = investigationGuide
    .flatMap((entry, order) =>
      entry.contexts
        .filter((context) => reasons.has(context))
        .map((context) => ({
          entry,
          context,
          reason: reasons.get(context)!,
          order,
        })),
    )
    .sort(
      (a, b) =>
        b.entry.priority - a.entry.priority ||
        a.order - b.order ||
        a.entry.id.localeCompare(b.entry.id),
    )
    .map(({ order: _order, ...match }) => match);
  return {
    contexts,
    matches,
    primary: matches[0] ?? null,
    stage: deriveInvestigationStage(input),
    checklist: deriveInvestigationChecklist(input),
  };
};

export const selectGuidance = selectInvestigationGuidance;
