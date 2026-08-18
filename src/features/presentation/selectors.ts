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

export type GraphRole = {
  roots: Set<string>;
  leaves: Set<string>;
  upstream: Set<string>;
  downstream: Set<string>;
  selectedPath: Set<string>;
  unrelated: Set<string>;
};

type PresentationNode = { id: string; nodeType?: ChainNodeData["nodeType"] };
type PresentationControl = {
  id: string;
  upstreamNodeId: string;
  downstreamNodeId: string;
};
type PresentationEdge = { source: string; target: string; kind?: string };

/** Pure, complete traversal of the causal graph in both directions. */
export const deriveGraphPresentation = (
  nodeIds: string[],
  edges: PresentationEdge[],
  selectedId: string | null,
): GraphRole => {
  const ids = new Set(nodeIds);
  const incoming = new Map(nodeIds.map((id) => [id, [] as string[]]));
  const outgoing = new Map(nodeIds.map((id) => [id, [] as string[]]));
  edges.forEach(({ source, target }) => {
    if (ids.has(source) && ids.has(target)) {
      outgoing.get(source)!.push(target);
      incoming.get(target)!.push(source);
    }
  });
  const walk = (start: string, graph: Map<string, string[]>) => {
    const found = new Set<string>();
    const pending = [...(graph.get(start) ?? [])];
    while (pending.length) {
      const id = pending.pop()!;
      if (found.has(id)) continue;
      found.add(id);
      pending.push(...(graph.get(id) ?? []));
    }
    return found;
  };
  const hasSelection = Boolean(selectedId && ids.has(selectedId));
  const upstream = hasSelection
    ? walk(selectedId!, incoming)
    : new Set<string>();
  const downstream = hasSelection
    ? walk(selectedId!, outgoing)
    : new Set<string>();
  const selectedPath = new Set([...upstream, ...downstream]);
  if (hasSelection) selectedPath.add(selectedId!);
  return {
    roots: new Set(nodeIds.filter((id) => incoming.get(id)?.length === 0)),
    leaves: new Set(nodeIds.filter((id) => outgoing.get(id)?.length === 0)),
    upstream,
    downstream,
    selectedPath,
    unrelated: new Set(
      hasSelection ? nodeIds.filter((id) => !selectedPath.has(id)) : [],
    ),
  };
};

/** Resolves node, Action, and Control selection to the whole review trace. */
export const deriveRelationshipPresentation = (
  nodes: PresentationNode[],
  edges: PresentationEdge[],
  controls: PresentationControl[],
  selectedId: string | null,
): GraphRole => {
  const causalIds = nodes
    .filter((node) => node.nodeType !== "Action")
    .map((node) => node.id);
  const causalEdges = edges.filter((edge) => edge.kind !== "ActionEdge");
  const action = nodes.find(
    (node) => node.id === selectedId && node.nodeType === "Action",
  );
  const control = controls.find((item) => item.id === selectedId);
  const actionEdge =
    action &&
    edges.find(
      (edge) => edge.kind === "ActionEdge" && edge.target === action.id,
    );
  const anchor = actionEdge?.source ?? (!control ? selectedId : null);
  const role = deriveGraphPresentation(causalIds, causalEdges, anchor);
  const selectedPath = new Set(role.selectedPath);
  let upstream = role.upstream;
  let downstream = role.downstream;
  if (control) {
    upstream = deriveGraphPresentation(
      causalIds,
      causalEdges,
      control.upstreamNodeId,
    ).upstream;
    downstream = deriveGraphPresentation(
      causalIds,
      causalEdges,
      control.downstreamNodeId,
    ).downstream;
    [
      ...upstream,
      control.upstreamNodeId,
      control.downstreamNodeId,
      ...downstream,
    ].forEach((id) => selectedPath.add(id));
    selectedPath.add(control.id);
  }
  if (action) selectedPath.add(action.id);
  edges
    .filter(
      (edge) => edge.kind === "ActionEdge" && selectedPath.has(edge.source),
    )
    .forEach((edge) => selectedPath.add(edge.target));
  controls
    .filter(
      (item) =>
        selectedPath.has(item.upstreamNodeId) &&
        selectedPath.has(item.downstreamNodeId),
    )
    .forEach((item) => selectedPath.add(item.id));
  const allIds = [
    ...nodes.map((node) => node.id),
    ...controls.map((item) => item.id),
  ];
  const hasSelection = Boolean(control || anchor);
  return {
    ...role,
    upstream,
    downstream,
    selectedPath,
    unrelated: new Set(
      hasSelection ? allIds.filter((id) => !selectedPath.has(id)) : [],
    ),
  };
};

export type HoverPresentation = {
  emphasizedIds: Set<string>;
  emphasizedEdges: Set<string>;
};

/** Direct, transient neighborhood used only for canvas hover styling. */
export const deriveHoverPresentation = (
  nodes: PresentationNode[],
  edges: Array<PresentationEdge & { id: string }>,
  controls: PresentationControl[],
  hoveredId: string | null,
): HoverPresentation => {
  const emphasizedIds = new Set<string>();
  const emphasizedEdges = new Set<string>();
  if (!hoveredId) return { emphasizedIds, emphasizedEdges };
  const control = controls.find((item) => item.id === hoveredId);
  if (control) {
    [control.id, control.upstreamNodeId, control.downstreamNodeId].forEach(
      (id) => emphasizedIds.add(id),
    );
    edges
      .filter(
        (edge) =>
          edge.kind !== "ActionEdge" &&
          edge.source === control.upstreamNodeId &&
          edge.target === control.downstreamNodeId,
      )
      .forEach((edge) => emphasizedEdges.add(edge.id));
    return { emphasizedIds, emphasizedEdges };
  }
  if (
    !nodes.some((node) => node.id === hoveredId && node.nodeType !== "Action")
  )
    return { emphasizedIds, emphasizedEdges };
  emphasizedIds.add(hoveredId);
  edges
    .filter(
      (edge) =>
        edge.kind !== "ActionEdge" &&
        (edge.source === hoveredId || edge.target === hoveredId),
    )
    .forEach((edge) => {
      emphasizedEdges.add(edge.id);
      emphasizedIds.add(edge.source);
      emphasizedIds.add(edge.target);
    });
  edges
    .filter((edge) => edge.kind === "ActionEdge" && edge.source === hoveredId)
    .forEach((edge) => {
      emphasizedEdges.add(edge.id);
      emphasizedIds.add(edge.target);
    });
  controls
    .filter(
      (item) =>
        item.upstreamNodeId === hoveredId ||
        item.downstreamNodeId === hoveredId,
    )
    .forEach((item) => emphasizedIds.add(item.id));
  return { emphasizedIds, emphasizedEdges };
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
