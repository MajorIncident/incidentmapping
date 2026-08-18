import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode, ElkPort } from "elkjs/lib/elk-api";
import {
  CHAIN_NODE_HEIGHT,
  CHAIN_NODE_WIDTH,
  CONTROL_NODE_HEIGHT,
  CONTROL_NODE_WIDTH,
} from "../dimensions";
import type {
  CausalRouteRole,
  LayoutGraph,
  LayoutNodeGeometry,
  LayoutResult,
  OrthogonalRoute,
  RoutedRelationship,
} from "../layoutModel";
import { ELK_LAYERED_OPTIONS, elkSpacingOptions } from "./elkOptions";

const elk = new ELK();
const inputPort = (id: string): ElkPort => ({
  id: `${id}:in`,
  properties: { "elk.port.side": "NORTH" },
});
const outputPort = (id: string): ElkPort => ({
  id: `${id}:out`,
  properties: { "elk.port.side": "SOUTH" },
});
const ports = (id: string) => [inputPort(id), outputPort(id)];
const hint = (
  position: number | undefined,
  referenceId: string | undefined,
  id: string,
) =>
  [position ?? Number.MAX_SAFE_INTEGER, referenceId ?? "\uffff", id] as const;
const compareHints = (
  left: ReturnType<typeof hint>,
  right: ReturnType<typeof hint>,
) =>
  left[0] - right[0] ||
  left[1].localeCompare(right[1]) ||
  left[2].localeCompare(right[2]);

type ProjectedEdge = {
  id: string;
  relationshipId: string;
  kind: "Causal" | "Action";
  fromId: string;
  toId: string;
};

/** Translate an engine-neutral graph into an ELK graph; no UI or persistence types cross this boundary. */
export const toElkGraph = (
  graph: LayoutGraph,
  horizontalGap = 64,
  verticalGap = 64,
): { graph: ElkNode; edges: readonly ProjectedEdge[] } => {
  const actions = graph.actions ?? [];
  const controls = graph.controls ?? [];
  const allNodes = [...graph.nodes, ...actions].sort((left, right) =>
    compareHints(
      hint(left.position?.x, left.referenceId, left.id),
      hint(right.position?.x, right.referenceId, right.id),
    ),
  );
  const children: ElkNode[] = allNodes.map((node) => ({
    id: node.id,
    width: node.dimensions?.width ?? CHAIN_NODE_WIDTH,
    height: node.dimensions?.height ?? CHAIN_NODE_HEIGHT,
    ports: ports(node.id),
    layoutOptions: { "elk.portConstraints": "FIXED_SIDE" },
  }));
  const controlsByRelationship = new Map(
    controls.map((control) => [control.relationshipId, control]),
  );
  const projected: ProjectedEdge[] = [];
  graph.relationships.forEach((relationship) => {
    const control = controlsByRelationship.get(relationship.id);
    const stops = [
      relationship.fromId,
      ...(control ? [control.id] : []),
      relationship.toId,
    ];
    stops.slice(0, -1).forEach((fromId, index) => {
      projected.push({
        id:
          stops.length === 2 ? relationship.id : `${relationship.id}:${index}`,
        relationshipId: relationship.id,
        kind: relationship.kind,
        fromId,
        toId: stops[index + 1],
      });
    });
  });
  controls
    .slice()
    .sort((left, right) =>
      compareHints(
        hint(undefined, left.referenceId, left.id),
        hint(undefined, right.referenceId, right.id),
      ),
    )
    .forEach((control) =>
      children.push({
        id: control.id,
        width: control.dimensions?.width ?? CONTROL_NODE_WIDTH,
        height: control.dimensions?.height ?? CONTROL_NODE_HEIGHT,
        ports: ports(control.id),
        layoutOptions: { "elk.portConstraints": "FIXED_SIDE" },
      }),
    );
  const edges: ElkExtendedEdge[] = projected.map((edge) => ({
    id: edge.id,
    sources: [`${edge.fromId}:out`],
    targets: [`${edge.toId}:in`],
  }));
  return {
    graph: {
      id: "layout-root",
      children,
      edges,
      layoutOptions: {
        ...ELK_LAYERED_OPTIONS,
        ...elkSpacingOptions(horizontalGap, verticalGap),
      },
    },
    edges: projected,
  };
};

const edgeRole = (outgoing: number, incoming: number): CausalRouteRole =>
  outgoing > 1 && incoming > 1
    ? "BranchAndMerge"
    : outgoing > 1
      ? "Branch"
      : incoming > 1
        ? "Merge"
        : "Direct";

/** Runs ELK and returns complete geometry for prototype measurement and optional consumers. */
export const layoutWithElk = async (
  graph: LayoutGraph,
  options: { horizontalGap?: number; verticalGap?: number } = {},
): Promise<LayoutResult> => {
  const translated = toElkGraph(
    graph,
    options.horizontalGap,
    options.verticalGap,
  );
  const result = await elk.layout(translated.graph);
  const controls = new Map(
    (graph.controls ?? []).map((item) => [item.id, item]),
  );
  const actions = new Set((graph.actions ?? []).map((item) => item.id));
  const nodes: LayoutNodeGeometry[] = (result.children ?? []).map((node) => ({
    id: node.id,
    role: controls.has(node.id)
      ? "Control"
      : actions.has(node.id)
        ? "Action"
        : "Semantic",
    ...(controls.has(node.id)
      ? {
          controlId: node.id,
          relationshipId: controls.get(node.id)!.relationshipId,
        }
      : {}),
    rectangle: {
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: node.width ?? 0,
      height: node.height ?? 0,
    },
  }));
  const causal = graph.relationships.filter((edge) => edge.kind === "Causal");
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  causal.forEach((edge) => {
    outgoing.set(edge.fromId, (outgoing.get(edge.fromId) ?? 0) + 1);
    incoming.set(edge.toId, (incoming.get(edge.toId) ?? 0) + 1);
  });
  const metadata = new Map(translated.edges.map((edge) => [edge.id, edge]));
  const relationships: RoutedRelationship[] = (result.edges ?? []).flatMap(
    (edge) => {
      const data = metadata.get(edge.id);
      if (!data) return [];
      const route = edge.sections?.[0];
      if (!route) return [];
      const points = [
        route.startPoint,
        ...(route.bendPoints ?? []),
        route.endPoint,
      ] as unknown as OrthogonalRoute;
      return [
        {
          ...data,
          role: edgeRole(
            outgoing.get(data.fromId) ?? 0,
            incoming.get(data.toId) ?? 0,
          ),
          route: points,
        },
      ];
    },
  );
  return {
    nodes,
    relationships,
    bounds: {
      x: 0,
      y: 0,
      width: result.width ?? 0,
      height: result.height ?? 0,
    },
  };
};
