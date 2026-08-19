import type { LayoutGraph, SemanticNodeKind } from "./layoutModel";

export type LayoutAdapterNode = Readonly<{
  id: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  data: Readonly<{
    nodeType?: SemanticNodeKind | "Action";
    referenceId?: string;
    eventDisplay?: "Map" | "ChronologyOnly";
    timestamp?: string;
  }>;
}>;
export type LayoutAdapterEdge = Readonly<{
  id: string;
  source: string;
  target: string;
  data?: Readonly<{ kind?: string }>;
}>;
export type LayoutAdapterControl = Readonly<{
  id: string;
  upstreamNodeId: string;
  downstreamNodeId: string;
  referenceId?: string;
}>;

/** The sole application-to-engine translation. It intentionally preserves chronology semantics. */
export const buildLayoutGraph = ({
  nodes,
  edges,
  barriers = [],
  measuredControlDimensions = {},
  dimensions,
}: {
  nodes: readonly LayoutAdapterNode[];
  edges: readonly LayoutAdapterEdge[];
  barriers?: readonly LayoutAdapterControl[];
  measuredControlDimensions?: Readonly<
    Record<string, { width: number; height: number }>
  >;
  dimensions: (node: LayoutAdapterNode) => { width: number; height: number };
}): LayoutGraph => {
  const actionIds = new Set(
    nodes
      .filter((node) => node.data.nodeType === "Action")
      .map((node) => node.id),
  );
  const anchors = new Map(
    edges
      .filter((edge) => edge.data?.kind === "ActionEdge")
      .map((edge) => [edge.target, edge.source]),
  );
  const relationships = edges.map((edge) => ({
    id: edge.id,
    kind:
      edge.data?.kind === "ActionEdge"
        ? ("Action" as const)
        : ("Causal" as const),
    fromId: edge.source,
    toId: edge.target,
  }));
  return {
    nodes: nodes
      .filter((node) => !actionIds.has(node.id))
      .map((node) => ({
        id: node.id,
        kind:
          node.data.nodeType === "Event" || node.data.nodeType === "Impact"
            ? node.data.nodeType
            : "Factor",
        referenceId: node.data.referenceId,
        position: node.position,
        dimensions: dimensions(node),
        eventDisplay: node.data.eventDisplay,
      })),
    actions: nodes
      .filter((node) => actionIds.has(node.id))
      .map((node) => ({
        id: node.id,
        kind: "Action",
        attachedToId: anchors.get(node.id) ?? "",
        referenceId: node.data.referenceId,
        position: node.position,
        dimensions: dimensions(node),
      })),
    relationships,
    controls: barriers.flatMap((control) => {
      const relationship = relationships.find(
        (edge) =>
          edge.kind === "Causal" &&
          edge.fromId === control.upstreamNodeId &&
          edge.toId === control.downstreamNodeId,
      );
      return relationship
        ? [
            {
              id: control.id,
              kind: "Control" as const,
              relationshipId: relationship.id,
              upstreamNodeId: control.upstreamNodeId,
              downstreamNodeId: control.downstreamNodeId,
              referenceId: control.referenceId,
              dimensions: measuredControlDimensions[control.id],
            },
          ]
        : [];
    }),
    chronology: nodes
      .filter(
        (node) =>
          node.data.nodeType === "Event" &&
          node.data.eventDisplay === "ChronologyOnly" &&
          node.data.timestamp,
      )
      .map((node, order) => ({
        nodeId: node.id,
        timestamp: node.data.timestamp!,
        order,
      })),
  };
};
