import type { Edge, Node } from "reactflow";
import type { MapData } from "../../../src/features/maps/schema";

export type LayoutControl = MapData["barriers"][number];
export type LayoutTopology = {
  nodes: Node<MapData["nodes"][number]>[];
  edges: Edge[];
  controls: LayoutControl[];
};

/** Converts persisted case semantics into the common input used by layout tests. */
export const buildTopology = (map: MapData): LayoutTopology => ({
  nodes: map.nodes.map((item) => ({
    id: item.id,
    type: "ChainNode",
    position: { ...item.position },
    data: { ...item },
  })),
  edges: map.edges.map((item) => ({
    id: item.id,
    source: item.fromId,
    target: item.toId,
    data: { kind: item.kind },
  })),
  controls: map.barriers.map((item) => ({ ...item })),
});

export type TopologyNode = {
  id: string;
  nodeType?: MapData["nodes"][number]["nodeType"];
};
export type TopologyEdge = {
  from: string;
  to: string;
  kind?: "CauseEffectEdge" | "ActionEdge";
};

/** Small builder for tests that need a topology variant without persisting fake entities. */
export const buildSyntheticTopology = (
  nodeSpecs: readonly TopologyNode[],
  edgeSpecs: readonly TopologyEdge[],
): LayoutTopology => ({
  nodes: nodeSpecs.map(({ id, nodeType = "Factor" }) => ({
    id,
    type: "ChainNode",
    position: { x: 0, y: 0 },
    data: {
      id,
      kind: "ChainNode",
      referenceId: id,
      nodeType,
      title: id,
      evidenceIds: [],
      contextItems: [],
      position: { x: 0, y: 0 },
      ...(nodeType === "Event" ? { eventDisplay: "Map" as const } : {}),
    },
  })),
  edges: edgeSpecs.map(({ from, to, kind = "CauseEffectEdge" }, index) => ({
    id: `edge-${index + 1}`,
    source: from,
    target: to,
    data: { kind },
  })),
  controls: [],
});
