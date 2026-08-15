import type { Edge, Node, XYPosition } from "reactflow";

export const GRID_SIZE = 8;

const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_NODE_HEIGHT = 140;
const DETAILS_HEIGHT = 140;
const HORIZONTAL_GAP = 32;
const VERTICAL_GAP = 32;
const TREE_GAP = 64;

export const snapPosition = ({ x, y }: XYPosition): XYPosition => ({
  x: Math.round(x / GRID_SIZE) * GRID_SIZE,
  y: Math.round(y / GRID_SIZE) * GRID_SIZE,
});

const sizeOf = <Data>(node: Node<Data>, showDetails: boolean) => ({
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
    if (!children.includes(edge.target)) {
      children.push(edge.target);
    }
    result.set(edge.source, children);
  });
  return result;
};

/**
 * Lays out every hierarchy from top to bottom. A subtree's footprint includes
 * all descendants, so sibling subtrees cannot overlap. Inputs are never
 * mutated and identical inputs always produce identical positions.
 */
export const layoutHierarchy = <Data>(
  nodes: Node<Data>[],
  edges: Edge[],
  showDetails: boolean,
): Node<Data>[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = buildChildrenByParent(edges);
  const childIds = new Set(edges.map((edge) => edge.target));
  const roots = nodes
    .filter((node) => !childIds.has(node.id))
    .sort((a, b) => a.position.x - b.position.x || a.id.localeCompare(b.id));
  const seen = new Set<string>();

  const footprintMemo = new Map<string, number>();
  const footprint = (id: string, ancestors = new Set<string>()): number => {
    const cached = footprintMemo.get(id);
    if (cached !== undefined) return cached;
    const node = byId.get(id);
    if (!node || ancestors.has(id)) return 0;
    const nextAncestors = new Set(ancestors).add(id);
    const childWidths = (childrenByParent.get(id) ?? [])
      .filter((childId) => byId.has(childId))
      .map((childId) => footprint(childId, nextAncestors));
    const childrenWidth =
      childWidths.reduce((total, width) => total + width, 0) +
      Math.max(0, childWidths.length - 1) * HORIZONTAL_GAP;
    const width = Math.max(sizeOf(node, showDetails).width, childrenWidth);
    footprintMemo.set(id, width);
    return width;
  };

  const positions = new Map<string, XYPosition>();
  const place = (
    id: string,
    left: number,
    y: number,
    ancestors = new Set<string>(),
  ) => {
    const node = byId.get(id);
    if (!node || ancestors.has(id) || seen.has(id)) return;
    seen.add(id);
    const nextAncestors = new Set(ancestors).add(id);
    const nodeSize = sizeOf(node, showDetails);
    const ownFootprint = footprint(id);
    positions.set(
      id,
      snapPosition({ x: left + (ownFootprint - nodeSize.width) / 2, y }),
    );

    const children = (childrenByParent.get(id) ?? []).filter((childId) =>
      byId.has(childId),
    );
    if (!children.length) return;
    const widths = children.map((childId) => footprint(childId));
    const groupWidth =
      widths.reduce((total, width) => total + width, 0) +
      (widths.length - 1) * HORIZONTAL_GAP;
    let childLeft = left + (ownFootprint - groupWidth) / 2;
    const childY = y + nodeSize.height + VERTICAL_GAP;
    children.forEach((childId, index) => {
      place(childId, childLeft, childY, nextAncestors);
      childLeft += widths[index] + HORIZONTAL_GAP;
    });
  };

  let treeLeft = roots.length
    ? Math.min(...roots.map((root) => root.position.x))
    : 0;
  roots.forEach((root) => {
    place(root.id, treeLeft, root.position.y);
    treeLeft += footprint(root.id) + TREE_GAP;
  });

  // Malformed/cyclic maps still get deterministic, collision-free islands.
  nodes
    .filter((node) => !seen.has(node.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((node) => {
      place(node.id, treeLeft, node.position.y);
      treeLeft += footprint(node.id) + TREE_GAP;
    });

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? snapPosition(node.position),
  }));
};

export const applyHierarchyLayout = <Data>(
  nodes: Node<Data>[],
  edges: Edge[],
  showDetails: boolean,
): { nodes: Node<Data>[]; changed: boolean } => {
  const laidOut = layoutHierarchy(nodes, edges, showDetails);
  return {
    nodes: laidOut,
    changed: laidOut.some(
      (node, index) =>
        node.position.x !== nodes[index]?.position.x ||
        node.position.y !== nodes[index]?.position.y,
    ),
  };
};
