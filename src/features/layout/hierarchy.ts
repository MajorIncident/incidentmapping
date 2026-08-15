import type { Edge, Node, XYPosition } from "reactflow";

export const GRID_SIZE = 8;

export const DEFAULT_NODE_WIDTH = 240;
export const DEFAULT_NODE_HEIGHT = 140;
export const DETAILS_HEIGHT = 140;
export const HORIZONTAL_GAP = 32;
export const VERTICAL_GAP = 64;
const BARRIER_CLEARANCE = 176;
const TREE_GAP = 96;

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
  width: node.width ?? DEFAULT_NODE_WIDTH,
  height:
    node.height ??
    (showDetails ? DEFAULT_NODE_HEIGHT + DETAILS_HEIGHT : DEFAULT_NODE_HEIGHT),
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
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = buildChildrenByParent(
    edges.filter((edge) => byId.has(edge.source) && byId.has(edge.target)),
  );
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  edges.forEach((edge) => {
    if (byId.has(edge.source) && byId.has(edge.target)) {
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    }
  });
  const stable = (a: Node<Data>, b: Node<Data>) =>
    a.position.x - b.position.x ||
    a.position.y - b.position.y ||
    a.id.localeCompare(b.id);
  const discoveredRoots = nodes
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
  for (const node of [...nodes].sort(stable)) {
    if (!visited.has(node.id)) {
      roots.push(node.id);
      walk(node.id, 0);
    }
  }

  const widths = new Map<string, number>();
  const measure = (id: string): number => {
    const children = forestChildren.get(id) ?? [];
    const childrenWidth = children.reduce(
      (sum, childId, index) =>
        sum + measure(childId) + (index ? HORIZONTAL_GAP : 0),
      0,
    );
    const width = Math.max(
      getNodeSize(byId.get(id)!, showDetails).width,
      childrenWidth,
    );
    widths.set(id, width);
    return width;
  };
  roots.forEach(measure);

  const maxDepth = Math.max(...depth.values());
  const levelHeights = Array.from({ length: maxDepth + 1 }, () => 0);
  nodes.forEach((node) => {
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
  const levelY = [Math.min(...nodes.map((node) => node.position.y))];
  for (let level = 0; level < maxDepth; level += 1) {
    levelY[level + 1] =
      levelY[level] +
      levelHeights[level] +
      VERTICAL_GAP +
      (barrierLevels.has(level) ? BARRIER_CLEARANCE : 0);
  }

  const positions = new Map<string, XYPosition>();
  const place = (id: string, left: number) => {
    const node = byId.get(id)!;
    const footprint = widths.get(id)!;
    positions.set(
      id,
      snapPosition({
        x: left + (footprint - getNodeSize(node, showDetails).width) / 2,
        y: levelY[depth.get(id) ?? 0],
      }),
    );
    let childLeft = left;
    for (const childId of forestChildren.get(id) ?? []) {
      place(childId, childLeft);
      childLeft += widths.get(childId)! + HORIZONTAL_GAP;
    }
  };
  let treeLeft = Math.min(...nodes.map((node) => node.position.x));
  roots.forEach((id) => {
    place(id, treeLeft);
    treeLeft += widths.get(id)! + TREE_GAP;
  });

  return nodes.map((node) => ({ ...node, position: positions.get(node.id)! }));
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
