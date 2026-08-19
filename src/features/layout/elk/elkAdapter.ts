import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode, ElkPort } from "elkjs/lib/elk-api";
import {
  CHAIN_NODE_HEIGHT,
  CHAIN_NODE_WIDTH,
  CONTROL_NODE_HEIGHT,
  CONTROL_NODE_WIDTH,
} from "../dimensions";
import { centerAlignmentDelta } from "../geometry/alignment";
import { boundsOf } from "../investigationLayout";
import {
  ACTION_GAP,
  CAUSAL_ROW_GAP,
  OBJECT_CLEARANCE,
  SIBLING_GAP,
  requiredRankInterval,
} from "../geometry/spacing";
import type {
  CausalRouteRole,
  LayoutGraph,
  LayoutNodeGeometry,
  LayoutResult,
  OrthogonalRoute,
  RoutedRelationship,
} from "../layoutModel";
import { placeActionStacks } from "../routing/actionRouting";
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
  kind: "Causal";
  fromId: string;
  toId: string;
};

/** Translate an engine-neutral graph into an ELK graph; no UI or persistence types cross this boundary. */
export const toElkGraph = (
  graph: LayoutGraph,
  horizontalGap = SIBLING_GAP,
  verticalGap = CAUSAL_ROW_GAP,
): { graph: ElkNode; edges: readonly ProjectedEdge[] } => {
  const chronologyIds = new Set(
    graph.nodes
      .filter((node) => node.eventDisplay === "ChronologyOnly")
      .map((node) => node.id),
  );
  const allNodes = graph.nodes
    .filter((node) => !chronologyIds.has(node.id))
    .sort((left, right) =>
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
  const projected: ProjectedEdge[] = [];
  graph.relationships
    .filter(
      (relationship) =>
        relationship.kind === "Causal" &&
        !chronologyIds.has(relationship.fromId) &&
        !chronologyIds.has(relationship.toId),
    )
    .forEach((relationship) =>
      projected.push({
        id: relationship.id,
        relationshipId: relationship.id,
        kind: "Causal",
        fromId: relationship.fromId,
        toId: relationship.toId,
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
  const engineNodes = new Map(
    (result.children ?? []).map((node) => [node.id, node]),
  );
  const stableIds = [...translated.graph.children!].map((node) => node.id);
  const nodes: LayoutNodeGeometry[] = stableIds.flatMap((id) => {
    const node = engineNodes.get(id);
    if (!node) return [];
    return [
      {
        id: node.id,
        role: controls.has(node.id) ? "Control" : "Semantic",
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
      },
    ];
  });
  // Actions are deliberately absent from the ELK input. Materialise their
  // geometry only after the causal graph has been laid out, so an auxiliary
  // card can never perturb its anchor or the causal layers around it.
  (graph.controls ?? []).forEach((control) =>
    nodes.push({
      id: control.id,
      role: "Control",
      controlId: control.id,
      relationshipId: control.relationshipId,
      rectangle: {
        x: 0,
        y: 0,
        width: control.dimensions?.width ?? CONTROL_NODE_WIDTH,
        height: control.dimensions?.height ?? CONTROL_NODE_HEIGHT,
      },
    }),
  );
  (graph.actions ?? []).forEach((action) =>
    nodes.push({
      id: action.id,
      role: "Action",
      rectangle: {
        x: 0,
        y: 0,
        width: action.dimensions?.width ?? CHAIN_NODE_WIDTH,
        height: action.dimensions?.height ?? CHAIN_NODE_HEIGHT,
      },
    }),
  );
  const causal = graph.relationships.filter((edge) => edge.kind === "Causal");
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  causal.forEach((edge) => {
    outgoing.set(edge.fromId, (outgoing.get(edge.fromId) ?? 0) + 1);
    incoming.set(edge.toId, (incoming.get(edge.toId) ?? 0) + 1);
  });

  // ELK supplies crossing-minimised horizontal order. Vertical geometry is a
  // layout invariant of the causal DAG: all incoming relationships contribute
  // to longest-path rank, and every card in a rank shares one measured origin.
  const semanticIds = new Set(graph.nodes.map((node) => node.id));
  const causalChildren = new Map<string, string[]>();
  const remainingIncoming = new Map(graph.nodes.map((node) => [node.id, 0]));
  causal.forEach((edge) => {
    if (!semanticIds.has(edge.fromId) || !semanticIds.has(edge.toId)) return;
    const children = causalChildren.get(edge.fromId) ?? [];
    if (!children.includes(edge.toId)) children.push(edge.toId);
    causalChildren.set(edge.fromId, children);
    remainingIncoming.set(
      edge.toId,
      (remainingIncoming.get(edge.toId) ?? 0) + 1,
    );
  });
  const rank = new Map(graph.nodes.map((node) => [node.id, 0]));
  const stableNodeOrder = graph.nodes
    .slice()
    .sort((left, right) =>
      compareHints(
        hint(
          left.layoutHints?.order ?? left.position?.x,
          left.referenceId,
          left.id,
        ),
        hint(
          right.layoutHints?.order ?? right.position?.x,
          right.referenceId,
          right.id,
        ),
      ),
    );
  const queue = stableNodeOrder
    .filter((node) => remainingIncoming.get(node.id) === 0)
    .map((node) => node.id);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    for (const childId of causalChildren.get(id) ?? []) {
      rank.set(
        childId,
        Math.max(rank.get(childId) ?? 0, (rank.get(id) ?? 0) + 1),
      );
      const remaining = (remainingIncoming.get(childId) ?? 1) - 1;
      remainingIncoming.set(childId, remaining);
      if (remaining === 0) queue.push(childId);
    }
  }
  const geometryById = new Map(nodes.map((node) => [node.id, node]));
  const ranks = new Map<number, LayoutNodeGeometry[]>();
  graph.nodes.forEach((node) => {
    const geometry = geometryById.get(node.id);
    if (!geometry) return;
    const level = rank.get(node.id) ?? 0;
    ranks.set(level, [...(ranks.get(level) ?? []), geometry]);
  });
  const controlHeightsByRank = new Map<number, number[]>();
  (graph.controls ?? []).forEach((control) => {
    const targetRank = rank.get(control.downstreamNodeId);
    if (targetRank === undefined) return;
    controlHeightsByRank.set(targetRank, [
      ...(controlHeightsByRank.get(targetRank) ?? []),
      control.dimensions?.height ?? CONTROL_NODE_HEIGHT,
    ]);
  });
  let rankY = 0;
  [...ranks.keys()]
    .sort((a, b) => a - b)
    .forEach((level) => {
      const members = ranks.get(level)!;
      members.sort(
        (a, b) => a.rectangle.x - b.rectangle.x || a.id.localeCompare(b.id),
      );
      let right = -Infinity;
      members.forEach((member) => {
        const x = Math.max(member.rectangle.x, right + OBJECT_CLEARANCE);
        (member.rectangle as { x: number; y: number }).x = x;
        (member.rectangle as { x: number; y: number }).y = rankY;
        right = x + member.rectangle.width;
      });
      const nextLevel = level + 1;
      const intervalEdges = causal.filter(
        (edge) =>
          (rank.get(edge.fromId) ?? 0) === level &&
          (rank.get(edge.toId) ?? 0) === nextLevel,
      );
      const requiresRail = intervalEdges.some(
        (edge) =>
          (outgoing.get(edge.fromId) ?? 0) > 1 ||
          (incoming.get(edge.toId) ?? 0) > 1,
      );
      rankY +=
        Math.max(...members.map((member) => member.rectangle.height)) +
        requiredRankInterval(
          requiresRail,
          controlHeightsByRank.get(nextLevel) ?? [],
        );
    });

  // Preserve ELK's ordering for branches and merges, but make an unambiguous
  // straight causal chain share one horizontal centre. Parents are visited
  // before children, making alignment deterministic for chains of any length.
  queue.forEach((childId) => {
    const parentEdges = causal.filter((edge) => edge.toId === childId);
    if (parentEdges.length !== 1) return;
    const parentId = parentEdges[0].fromId;
    if ((outgoing.get(parentId) ?? 0) !== 1) return;
    const parent = geometryById.get(parentId);
    const child = geometryById.get(childId);
    if (!parent || !child) return;
    (child.rectangle as { x: number }).x += centerAlignmentDelta(
      parent.rectangle,
      child.rectangle,
    );
  });

  // Controls are centred in the actual interval between their endpoint ranks.
  // A stable sub-lane offset prevents controls sharing a target lane from
  // competing for the same rectangle.
  const controlGroups = new Map<string, LayoutNodeGeometry[]>();
  (graph.controls ?? []).forEach((control) => {
    const geometry = geometryById.get(control.id);
    const target = geometryById.get(control.downstreamNodeId);
    if (!geometry || !target) return;
    const targetRank = rank.get(control.downstreamNodeId) ?? 0;
    const source = geometryById.get(control.upstreamNodeId);
    if (!source) return;
    const spaceTop = source.rectangle.y + source.rectangle.height;
    const spaceBottom = target.rectangle.y;
    (geometry.rectangle as { x: number; y: number }).x =
      target.rectangle.x +
      target.rectangle.width / 2 -
      geometry.rectangle.width / 2;
    (geometry.rectangle as { x: number; y: number }).y =
      spaceTop + (spaceBottom - spaceTop - geometry.rectangle.height) / 2;
    const key = `${targetRank}:${target.rectangle.x + target.rectangle.width / 2}`;
    controlGroups.set(key, [...(controlGroups.get(key) ?? []), geometry]);
  });
  controlGroups.forEach((members) => {
    members.sort((a, b) =>
      (a.relationshipId ?? a.id).localeCompare(b.relationshipId ?? b.id),
    );
    const lane =
      members.reduce(
        (sum, member) => sum + member.rectangle.x + member.rectangle.width / 2,
        0,
      ) / members.length;
    const total =
      members.reduce((sum, member) => sum + member.rectangle.width, 0) +
      ACTION_GAP * Math.max(0, members.length - 1);
    let left = lane - total / 2;
    members.forEach((member) => {
      (member.rectangle as { x: number }).x = left;
      left += member.rectangle.width + ACTION_GAP;
    });
  });

  // One projection owns Action geometry in ELK and incremental rendering.
  const actionIds = new Set((graph.actions ?? []).map((action) => action.id));
  const causalObjects = nodes.filter((node) => !actionIds.has(node.id));
  const causalRight = Math.max(
    0,
    ...causalObjects.map((node) => node.rectangle.x + node.rectangle.width),
  );
  const actionGeometry = placeActionStacks(graph.actions ?? [], causalObjects, {
    x: 0,
    y: 0,
    width: causalRight,
    height: 0,
  });
  nodes.splice(0, nodes.length, ...causalObjects, ...actionGeometry);
  actionGeometry.forEach((geometry) => geometryById.set(geometry.id, geometry));
  const metadata = new Map(translated.edges.map((edge) => [edge.id, edge]));
  const engineEdges = new Map(
    (result.edges ?? []).map((edge) => [edge.id, edge]),
  );
  const relationships: RoutedRelationship[] = translated.edges.flatMap(
    (stableEdge) => {
      const edge = engineEdges.get(stableEdge.id);
      if (!edge) return [];
      const data = metadata.get(edge.id);
      if (!data) return [];
      const from = geometryById.get(data.fromId);
      const to = geometryById.get(data.toId);
      if (!from || !to) return [];
      const start = {
        x: from.rectangle.x + from.rectangle.width / 2,
        y: from.rectangle.y + from.rectangle.height,
      };
      const end = {
        x: to.rectangle.x + to.rectangle.width / 2,
        y: to.rectangle.y,
      };
      const railY = (start.y + end.y) / 2;
      const points = [
        start,
        { x: start.x, y: railY },
        { x: end.x, y: railY },
        end,
      ] as OrthogonalRoute;
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
    sharedSegments: [],
    bounds: boundsOf(nodes),
    causalBounds: boundsOf(nodes.filter((node) => node.role === "Semantic")),
  };
};
