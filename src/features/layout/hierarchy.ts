import type { Edge, Node, XYPosition } from "reactflow";
import {
  CHAIN_NODE_DETAILS_HEIGHT,
  CHAIN_NODE_HEIGHT,
  CHAIN_NODE_WIDTH,
  CONTROL_NODE_HEIGHT,
  CONTROL_NODE_WIDTH,
} from "./dimensions";

export const GRID_SIZE = 8;

export const HORIZONTAL_GAP = 32;
export const VERTICAL_GAP = 64;
export const CONTROL_VERTICAL_MARGIN = 32;
export const CONTROL_HORIZONTAL_MARGIN = 32;
const TREE_GAP = 96;
export const ACTION_HORIZONTAL_GAP = 64;
export const ACTION_VERTICAL_GAP = 24;

export type HierarchyLayoutOptions = {
  showDetails: boolean;
  /** Edges containing a rendered barrier card need a larger level gap. */
  barrierEdges?: ReadonlyArray<{
    upstreamNodeId: string;
    downstreamNodeId: string;
  }>;
};

export const snapPosition = ({ x, y }: XYPosition): XYPosition => ({
  x: Math.round(x / GRID_SIZE) * GRID_SIZE,
  y: Math.round(y / GRID_SIZE) * GRID_SIZE,
});

export const getNodeSize = <Data>(node: Node<Data>, showDetails: boolean) => ({
  width: node.width ?? CHAIN_NODE_WIDTH,
  height:
    node.height ??
    (showDetails
      ? CHAIN_NODE_HEIGHT + CHAIN_NODE_DETAILS_HEIGHT
      : CHAIN_NODE_HEIGHT),
});

/** Cause/effect adjacency in stable edge order. */
export const buildChildrenByParent = (edges: Edge[]): Map<string, string[]> => {
  const result = new Map<string, string[]>();
  edges.forEach((edge) => {
    const children = result.get(edge.source) ?? [];
    if (!children.includes(edge.target)) children.push(edge.target);
    result.set(edge.source, children);
  });
  return result;
};

/**
 * Pure, deterministic full-graph layout. It first turns even malformed input
 * into a spanning forest, then measures that forest bottom-up before placing
 * parents over their child groups. Inputs are never mutated.
 */
export const layoutHierarchy = <Data>(
  nodes: Node<Data>[],
  edges: Edge[],
  options: boolean | HierarchyLayoutOptions,
): Node<Data>[] => {
  if (!nodes.length) return [];
  const { showDetails, barrierEdges = [] } =
    typeof options === "boolean" ? { showDetails: options } : options;
  const actionNodes = nodes.filter(
    (node) => (node.data as { nodeType?: string }).nodeType === "Action",
  );
  const actionById = new Map(actionNodes.map((node) => [node.id, node]));
  const causalNodes = nodes.filter(
    (node) => (node.data as { nodeType?: string }).nodeType !== "Action",
  );
  if (!causalNodes.length) return nodes.map((node) => ({ ...node }));
  const causalEdges = edges.filter((edge) => edge.data?.kind !== "ActionEdge");
  const byId = new Map(causalNodes.map((node) => [node.id, node]));
  // Build these columns before measuring the forest: an action is part of its
  // source's visual footprint, even though ActionEdges are not causal edges.
  // Edge order is intentional and provides stable ordering within a column.
  const actionsBySource = new Map<string, Node<Data>[]>();
  edges.forEach((edge) => {
    if (edge.data?.kind !== "ActionEdge" || !byId.has(edge.source)) return;
    const action = actionById.get(edge.target);
    if (!action) return;
    const attached = actionsBySource.get(edge.source) ?? [];
    if (!attached.some((node) => node.id === action.id)) attached.push(action);
    actionsBySource.set(edge.source, attached);
  });
  const actionColumns = new Map<string, { width: number; height: number }>();
  actionsBySource.forEach((actions, sourceId) => {
    actionColumns.set(sourceId, {
      width: Math.max(
        ...actions.map((action) => getNodeSize(action, showDetails).width),
      ),
      height:
        actions.reduce(
          (height, action) => height + getNodeSize(action, showDetails).height,
          0,
        ) +
        ACTION_VERTICAL_GAP * Math.max(0, actions.length - 1),
    });
  });
  const adjacency = buildChildrenByParent(
    causalEdges.filter(
      (edge) => byId.has(edge.source) && byId.has(edge.target),
    ),
  );
  const incoming = new Map(causalNodes.map((node) => [node.id, 0]));
  causalEdges.forEach((edge) => {
    if (byId.has(edge.source) && byId.has(edge.target)) {
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    }
  });
  const stable = (a: Node<Data>, b: Node<Data>) =>
    a.position.x - b.position.x ||
    a.position.y - b.position.y ||
    a.id.localeCompare(b.id);
  const discoveredRoots = causalNodes
    .filter((node) => incoming.get(node.id) === 0)
    .sort(stable);

  // Claim each node only once. This visited set makes cycles and shared
  // descendants safe while retaining stable edge order.
  const visited = new Set<string>();
  const forestChildren = new Map<string, string[]>();
  const depth = new Map<string, number>();
  const roots: string[] = [];
  const walk = (id: string, level: number) => {
    if (visited.has(id)) return;
    visited.add(id);
    depth.set(id, level);
    const claimed: string[] = [];
    for (const childId of adjacency.get(id) ?? []) {
      if (!visited.has(childId)) {
        claimed.push(childId);
        walk(childId, level + 1);
      }
    }
    forestChildren.set(id, claimed);
  };
  for (const root of discoveredRoots) {
    roots.push(root.id);
    walk(root.id, 0);
  }
  // A disconnected cycle has no zero-incoming node, so promote its first
  // stable member to an additional root and continue until all nodes belong.
  for (const node of [...causalNodes].sort(stable)) {
    if (!visited.has(node.id)) {
      roots.push(node.id);
      walk(node.id, 0);
    }
  }

  const widths = new Map<string, number>();
  const causalWidths = new Map<string, number>();
  const barrierEdgeKeys = new Set(
    barrierEdges.map(
      ({ upstreamNodeId, downstreamNodeId }) =>
        `${upstreamNodeId}\u0000${downstreamNodeId}`,
    ),
  );
  const hasBarrier = (source: string, target: string) =>
    barrierEdgeKeys.has(`${source}\u0000${target}`);
  const siblingGap = (
    parentId: string,
    leftId: string,
    rightId: string,
    leftWidth: number,
    rightWidth: number,
  ) => {
    if (!hasBarrier(parentId, leftId) || !hasBarrier(parentId, rightId))
      return HORIZONTAL_GAP;
    // Both Control centers lie halfway from their common parent to a child.
    // Consequently the child centers need twice the Control footprint between
    // them for the two cards to have the requested margin.
    return Math.max(
      HORIZONTAL_GAP,
      2 * (CONTROL_NODE_WIDTH + CONTROL_HORIZONTAL_MARGIN) -
        (leftWidth + rightWidth) / 2,
    );
  };
  const measure = (id: string): number => {
    const children = forestChildren.get(id) ?? [];
    const childWidths = children.map(measure);
    const childrenWidth = childWidths.reduce((sum, childWidth, index) => {
      if (!index) return childWidth;
      return (
        sum +
        siblingGap(
          id,
          children[index - 1],
          children[index],
          childWidths[index - 1],
          childWidth,
        ) +
        childWidth
      );
    }, 0);
    const nodeWidth = getNodeSize(byId.get(id)!, showDetails).width;
    const actionColumn = actionColumns.get(id);
    const causalWidth = Math.max(nodeWidth, childrenWidth);
    const width = actionColumn
      ? causalWidth + ACTION_HORIZONTAL_GAP + actionColumn.width
      : causalWidth;
    causalWidths.set(id, causalWidth);
    widths.set(id, width);
    return width;
  };
  roots.forEach(measure);

  const maxDepth = Math.max(...depth.values());
  const levelHeights = Array.from({ length: maxDepth + 1 }, () => 0);
  causalNodes.forEach((node) => {
    const level = depth.get(node.id) ?? 0;
    levelHeights[level] = Math.max(
      levelHeights[level],
      getNodeSize(node, showDetails).height,
    );
  });
  const barrierLevels = new Set<number>();
  barrierEdges.forEach((barrier) => {
    const upstreamDepth = depth.get(barrier.upstreamNodeId);
    if (
      upstreamDepth !== undefined &&
      depth.get(barrier.downstreamNodeId) === upstreamDepth + 1
    ) {
      barrierLevels.add(upstreamDepth);
    }
  });
  const levelY = [Math.min(...causalNodes.map((node) => node.position.y))];
  for (let level = 0; level < maxDepth; level += 1) {
    levelY[level + 1] =
      levelY[level] +
      levelHeights[level] +
      VERTICAL_GAP +
      (barrierLevels.has(level)
        ? CONTROL_NODE_HEIGHT + CONTROL_VERTICAL_MARGIN
        : 0);
  }

  const positions = new Map<string, XYPosition>();
  const actionPositions = new Map<string, XYPosition>();
  const place = (id: string, left: number) => {
    const node = byId.get(id)!;
    const nodeSize = getNodeSize(node, showDetails);
    const causalWidth = causalWidths.get(id)!;
    const sourcePosition = snapPosition({
      x: left + (causalWidth - nodeSize.width) / 2,
      y: levelY[depth.get(id) ?? 0],
    });
    positions.set(id, sourcePosition);
    let actionTop = sourcePosition.y;
    for (const action of actionsBySource.get(id) ?? []) {
      actionPositions.set(
        action.id,
        snapPosition({
          x: left + causalWidth + ACTION_HORIZONTAL_GAP,
          y: actionTop,
        }),
      );
      actionTop +=
        getNodeSize(action, showDetails).height + ACTION_VERTICAL_GAP;
    }
    let childLeft = left;
    const children = forestChildren.get(id) ?? [];
    for (const [index, childId] of children.entries()) {
      place(childId, childLeft);
      const nextId = children[index + 1];
      if (nextId) {
        childLeft +=
          widths.get(childId)! +
          siblingGap(
            id,
            childId,
            nextId,
            widths.get(childId)!,
            widths.get(nextId)!,
          );
      }
    }
  };
  let treeLeft = Math.min(...causalNodes.map((node) => node.position.x));
  roots.forEach((id) => {
    place(id, treeLeft);
    treeLeft += widths.get(id)! + TREE_GAP;
  });

  const causalResult = causalNodes.map((node) => ({
    ...node,
    position: positions.get(node.id)!,
  }));
  const placedById = new Map(causalResult.map((node) => [node.id, node]));
  return nodes.map((node) =>
    placedById.has(node.id)
      ? placedById.get(node.id)!
      : { ...node, position: actionPositions.get(node.id) ?? node.position },
  );
};

export const applyHierarchyLayout = <Data>(
  nodes: Node<Data>[],
  edges: Edge[],
  options: boolean | HierarchyLayoutOptions,
): { nodes: Node<Data>[]; changed: boolean } => {
  const laidOut = layoutHierarchy(nodes, edges, options);
  return {
    nodes: laidOut,
    changed: laidOut.some(
      (node, index) =>
        node.position.x !== nodes[index]?.position.x ||
        node.position.y !== nodes[index]?.position.y,
    ),
  };
};
