import type { Edge, Node } from "reactflow";
import type { EvidenceItem } from "../maps/schema";
import type { BarrierNodeData, ChainNodeData } from "../../state/useAppStore";

/** PresentationLens is deliberately view state. It must never be added to MapData. */
export type PresentationLens =
  | "Overview"
  | "Causal Story"
  | "Chronology"
  | "Controls"
  | "Actions"
  | "Evidence";

export const PRESENTATION_LENSES: PresentationLens[] = [
  "Overview",
  "Causal Story",
  "Chronology",
  "Controls",
  "Actions",
  "Evidence",
];

export type LensPresentation = {
  visibleIds: Set<string>;
  emphasizedIds: Set<string>;
  softenedIds: Set<string>;
  focusIds: string[];
  counts: Record<string, number>;
  showChronology: boolean;
};

type Input = {
  nodes: Node<ChainNodeData>[];
  edges: Edge[];
  controls: Array<BarrierNodeData & { id: string }>;
  evidence: EvidenceItem[];
  selectedId: string | null;
};

const linkedEvidenceEntities = (input: Input, evidenceId: string) => [
  ...input.nodes
    .filter((node) => node.data.evidenceIds?.includes(evidenceId))
    .map((node) => node.id),
  ...input.controls
    .filter((control) => control.evidenceIds?.includes(evidenceId))
    .map((control) => control.id),
];

/** Pure derivation: returned sets are new and input graph records are never changed. */
export const selectLensPresentation = (
  lens: PresentationLens,
  input: Input,
): LensPresentation => {
  const allIds = [
    ...input.nodes.map((node) => node.id),
    ...input.controls.map((control) => control.id),
  ];
  const visibleIds = new Set(allIds);
  const emphasizedIds = new Set<string>();
  const actionIds = new Set(
    input.nodes.filter((n) => n.data.nodeType === "Action").map((n) => n.id),
  );
  const chronologyOnly = new Set(
    input.nodes
      .filter((n) => n.data.eventDisplay === "ChronologyOnly")
      .map((n) => n.id),
  );
  const counts: Record<string, number> = {};

  if (lens === "Causal Story") {
    chronologyOnly.forEach((id) => visibleIds.delete(id));
    input.nodes
      .filter(
        (n) =>
          n.data.nodeType === "Impact" ||
          n.data.nodeType === "Event" ||
          n.data.nodeType === "Factor",
      )
      .forEach((n) => emphasizedIds.add(n.id));
    input.controls.forEach((control) => emphasizedIds.add(control.id));
  } else if (lens === "Chronology") {
    input.nodes
      .filter((n) => n.data.nodeType === "Event")
      .forEach((n) => emphasizedIds.add(n.id));
  } else if (lens === "Controls") {
    input.controls.forEach((control) => {
      emphasizedIds.add(control.id);
      emphasizedIds.add(control.upstreamNodeId);
      emphasizedIds.add(control.downstreamNodeId);
      counts[control.status] = (counts[control.status] ?? 0) + 1;
    });
  } else if (lens === "Actions") {
    actionIds.forEach((id) => emphasizedIds.add(id));
    input.edges
      .filter((edge) => edge.data?.kind === "ActionEdge")
      .forEach((edge) => emphasizedIds.add(edge.source));
  } else if (lens === "Evidence") {
    input.evidence.forEach((item) => {
      counts[item.type] = (counts[item.type] ?? 0) + 1;
    });
    const selectedEvidence = input.evidence.find(
      (item) => item.id === input.selectedId,
    );
    if (selectedEvidence)
      linkedEvidenceEntities(input, selectedEvidence.id).forEach((id) =>
        emphasizedIds.add(id),
      );
    else
      allIds.forEach((id) => {
        const node = input.nodes.find((item) => item.id === id);
        const control = input.controls.find((item) => item.id === id);
        if ((node?.data.evidenceIds ?? control?.evidenceIds)?.length)
          emphasizedIds.add(id);
      });
  }

  const selectedEntity = allIds.includes(input.selectedId ?? "")
    ? [input.selectedId!]
    : [];
  const focusIds =
    lens === "Evidence" && emphasizedIds.size
      ? [...emphasizedIds]
      : lens === "Chronology" && selectedEntity.length
        ? selectedEntity
        : [];
  const softenedIds = new Set(
    emphasizedIds.size ? allIds.filter((id) => !emphasizedIds.has(id)) : [],
  );
  if (lens === "Causal Story" || lens === "Controls")
    actionIds.forEach((id) => softenedIds.add(id));

  return {
    visibleIds,
    emphasizedIds,
    softenedIds,
    focusIds,
    counts,
    showChronology: lens === "Chronology",
  };
};
