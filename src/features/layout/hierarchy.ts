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
/** Space kept around cards and the lanes used to route their edges. */
export const OBJECT_CLEARANCE = 32;
/** Separates unconnected chronology from the causal forest. */
export const CHRONOLOGY_LANE_GAP = TREE_GAP;
export const ACTION_HORIZONTAL_GAP = 64;
export const ACTION_VERTICAL_GAP = 24;

export type HierarchyLayoutOptions = {
  showDetails: boolean;
  /** Edges containing a rendered barrier card need a larger level gap. */
  barrierEdges?: ReadonlyArray<{
    id?: string;
    upstreamNodeId: string;
    downstreamNodeId: string;
  }>;
  /** DOM measurements for generated Control cards. */
  controlDimensions?: Readonly<
    Record<string, { width: number; height: number }>
  >;
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
  const {
    showDetails,
    barrierEdges = [],
    controlDimensions = {},
  } = typeof options === "boolean" ? { showDetails: options } : options;
  const actionNodes = nodes.filter(
    (node) => (node.data as { nodeType?: string }).nodeType === "Action",
  );
  const actionById = new Map(actionNodes.map((node) => [node.id, node]));
  const nonActionNodes = nodes.filter(
    (node) => (node.data as { nodeType?: string }).nodeType !== "Action",
  );
  if (!nonActionNodes.length) return nodes.map((node) => ({ ...node }));
  const causalEdges = edges.filter((edge) => edge.data?.kind !== "ActionEdge");
  const nonActionIds = new Set(nonActionNodes.map((node) => node.id));
  const causallyConnectedIds = new Set<string>();
  causalEdges.forEach((edge) => {
    if (!nonActionIds.has(edge.source) || !nonActionIds.has(edge.target))
      return;
    causallyConnectedIds.add(edge.source);
    causallyConnectedIds.add(edge.target);
  });
  const chronologyNodes = nonActionNodes
    .filter((node) => {
      const data = node.data as {
        nodeType?: string;
        timestamp?: string;
        eventDisplay?: string;
      };
      return (
        data.nodeType === "Event" &&
        (data.eventDisplay === "ChronologyOnly" ||
          (Number.isFinite(Date.parse(data.timestamp ?? "")) &&
            !causallyConnectedIds.has(node.id)))
      );
    })
    .sort((a, b) => {
      const aTimestamp = Date.parse(
        (a.data as { timestamp?: string }).timestamp ?? "",
      );
      const bTimestamp = Date.parse(
        (b.data as { timestamp?: string }).timestamp ?? "",
      );
      return aTimestamp - bTimestamp || a.id.localeCompare(b.id);
    });
  const chronologyIds = new Set(chronologyNodes.map((node) => node.id));
  const causalNodes = nonActionNodes.filter(
    (node) => !chronologyIds.has(node.id),
  );
  const byId = new Map(causalNodes.map((node) => [node.id, node]));
  const layoutSourceIds = new Set(nonActionNodes.map((node) => node.id));
  // Build these columns before measuring the forest: an action is part of its
  // source's visual footprint, even though ActionEdges are not causal edges.
  // Edge order is intentional and provides stable ordering within a column.
  const actionsBySource = new Map<string, Node<Data>[]>();
  edges.forEach((edge) => {
    if (edge.data?.kind !== "ActionEdge" || !layoutSourceIds.has(edge.source))
      return;
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
  const barrierByEdge = new Map(
    barrierEdges.map((barrier) => [
      `${barrier.upstreamNodeId}\u0000${barrier.downstreamNodeId}`,
      barrier,
    ]),
  );
  const hasBarrier = (source: string, target: string) =>
    barrierByEdge.has(`${source}\u0000${target}`);
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
      2 *
        (Math.max(
          ...[leftId, rightId].map((id) => {
            const barrier = barrierByEdge.get(`${parentId}\u0000${id}`);
            return (
              (barrier?.id && controlDimensions[barrier.id]?.width) ||
              CONTROL_NODE_WIDTH
            );
          }),
        ) +
          CONTROL_HORIZONTAL_MARGIN) -
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

  const maxDepth = Math.max(0, ...depth.values());
  const levelHeights = Array.from({ length: maxDepth + 1 }, () => 0);
  causalNodes.forEach((node) => {
    const level = depth.get(node.id) ?? 0;
    levelHeights[level] = Math.max(
      levelHeights[level],
      getNodeSize(node, showDetails).height,
    );
  });
  const barrierLevelHeights = new Map<number, number>();
  barrierEdges.forEach((barrier) => {
    const upstreamDepth = depth.get(barrier.upstreamNodeId);
    if (
      upstreamDepth !== undefined &&
      depth.get(barrier.downstreamNodeId) === upstreamDepth + 1
    ) {
      barrierLevelHeights.set(
        upstreamDepth,
        Math.max(
          barrierLevelHeights.get(upstreamDepth) ?? 0,
          (barrier.id && controlDimensions[barrier.id]?.height) ||
            CONTROL_NODE_HEIGHT,
        ),
      );
    }
  });
  const layoutTop = Math.min(...nonActionNodes.map((node) => node.position.y));
  const levelY = [layoutTop];
  for (let level = 0; level < maxDepth; level += 1) {
    levelY[level + 1] =
      levelY[level] +
      levelHeights[level] +
      VERTICAL_GAP +
      (barrierLevelHeights.has(level)
        ? barrierLevelHeights.get(level)! + CONTROL_VERTICAL_MARGIN
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
  let treeLeft = Math.min(...nonActionNodes.map((node) => node.position.x));
  let causalRight = treeLeft;
  roots.forEach((id) => {
    place(id, treeLeft);
    causalRight = treeLeft + widths.get(id)!;
    treeLeft = causalRight + TREE_GAP;
  });

  type LayoutRectangle = {
    id: string;
    owner: string;
    associated: ReadonlySet<string>;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  const descendants = new Map<string, Set<string>>();
  const getDescendants = (id: string): Set<string> => {
    const cached = descendants.get(id);
    if (cached) return cached;
    const result = new Set([id]);
    for (const child of forestChildren.get(id) ?? []) {
      getDescendants(child).forEach((descendant) => result.add(descendant));
    }
    descendants.set(id, result);
    return result;
  };
  roots.forEach(getDescendants);

  const parentById = new Map<string, string>();
  forestChildren.forEach((children, parent) =>
    children.forEach((child) => parentById.set(child, parent)),
  );
  const shiftSubtree = (id: string, amount: number) => {
    const shifted = getDescendants(id);
    shifted.forEach((nodeId) => {
      const position = positions.get(nodeId);
      if (position)
        positions.set(nodeId, { ...position, x: position.x + amount });
      for (const action of actionsBySource.get(nodeId) ?? []) {
        const actionPosition = actionPositions.get(action.id);
        if (actionPosition)
          actionPositions.set(action.id, {
            ...actionPosition,
            x: actionPosition.x + amount,
          });
      }
    });
  };
  const recenterAncestors = (id: string) => {
    let parent = parentById.get(id);
    while (parent) {
      const children = forestChildren.get(parent) ?? [];
      if (children.length) {
        const first = children[0];
        const last = children[children.length - 1];
        const firstNode = byId.get(first)!;
        const lastNode = byId.get(last)!;
        const firstSize = getNodeSize(firstNode, showDetails);
        const lastSize = getNodeSize(lastNode, showDetails);
        const parentSize = getNodeSize(byId.get(parent)!, showDetails);
        const center =
          (positions.get(first)!.x +
            firstSize.width / 2 +
            (positions.get(last)!.x + lastSize.width / 2)) /
          2;
        const old = positions.get(parent)!;
        const nextX = snapPosition({
          x: center - parentSize.width / 2,
          y: 0,
        }).x;
        const delta = nextX - old.x;
        positions.set(parent, { ...old, x: nextX });
        for (const action of actionsBySource.get(parent) ?? []) {
          const actionPosition = actionPositions.get(action.id);
          if (actionPosition)
            actionPositions.set(action.id, {
              ...actionPosition,
              x: actionPosition.x + delta,
            });
        }
      }
      parent = parentById.get(parent);
    }
  };
  const rectangles = (): LayoutRectangle[] => {
    const result: LayoutRectangle[] = [];
    causalNodes.forEach((node) => {
      const size = getNodeSize(node, showDetails);
      const position = positions.get(node.id)!;
      result.push({
        id: `node:${node.id}`,
        owner: node.id,
        associated: new Set([node.id]),
        ...position,
        ...size,
      });
      for (const action of actionsBySource.get(node.id) ?? []) {
        const actionSize = getNodeSize(action, showDetails);
        result.push({
          id: `action:${action.id}`,
          owner: node.id,
          associated: new Set([node.id]),
          ...actionPositions.get(action.id)!,
          ...actionSize,
        });
      }
    });
    barrierEdges.forEach((barrier, index) => {
      const upstream = byId.get(barrier.upstreamNodeId);
      const downstream = byId.get(barrier.downstreamNodeId);
      const upstreamPosition = positions.get(barrier.upstreamNodeId);
      const downstreamPosition = positions.get(barrier.downstreamNodeId);
      if (!upstream || !downstream || !upstreamPosition || !downstreamPosition)
        return;
      const upstreamSize = getNodeSize(upstream, showDetails);
      const downstreamSize = getNodeSize(downstream, showDetails);
      const size = (barrier.id && controlDimensions[barrier.id]) || {
        width: CONTROL_NODE_WIDTH,
        height: CONTROL_NODE_HEIGHT,
      };
      result.push({
        id: `control:${barrier.id ?? index}`,
        owner: barrier.downstreamNodeId,
        associated: new Set([barrier.upstreamNodeId, barrier.downstreamNodeId]),
        x:
          (upstreamPosition.x +
            upstreamSize.width / 2 +
            downstreamPosition.x +
            downstreamSize.width / 2) /
            2 -
          size.width / 2,
        y:
          (upstreamPosition.y +
            upstreamSize.height / 2 +
            downstreamPosition.y +
            downstreamSize.height / 2) /
            2 -
          size.height / 2,
        ...size,
      });
    });
    return result;
  };
  const verticallyClose = (a: LayoutRectangle, b: LayoutRectangle) =>
    a.y < b.y + b.height + OBJECT_CLEARANCE &&
    a.y + a.height + OBJECT_CLEARANCE > b.y;

  // Validate the concrete visual objects rather than trusting a scalar tree
  // width.  Each correction moves a complete branch, then recenters its
  // ancestors; rebuilding the rectangles also recomputes Control and edge-lane
  // positions. Stable ordering and snapped corrections make this idempotent.
  for (let pass = 0; pass < causalNodes.length * 8 + 8; pass += 1) {
    const objects = rectangles().sort(
      (a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id),
    );
    let correction: { owner: string; amount: number } | undefined;
    for (
      let leftIndex = 0;
      leftIndex < objects.length && !correction;
      leftIndex += 1
    ) {
      const left = objects[leftIndex];
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < objects.length;
        rightIndex += 1
      ) {
        const right = objects[rightIndex];
        if (!verticallyClose(left, right)) continue;
        if (
          left.owner === right.owner ||
          left.associated.has(right.owner) ||
          right.associated.has(left.owner)
        )
          continue;
        const amount = left.x + left.width + OBJECT_CLEARANCE - right.x;
        if (amount > 0 && !getDescendants(right.owner).has(left.owner)) {
          correction = {
            owner: right.owner,
            amount: Math.ceil(amount / GRID_SIZE) * GRID_SIZE,
          };
          break;
        }
      }
    }
    if (!correction) break;
    shiftSubtree(correction.owner, correction.amount);
    recenterAncestors(correction.owner);
  }

  causalRight = Math.max(
    causalRight,
    ...rectangles().map((rectangle) => rectangle.x + rectangle.width),
  );

  // Timestamped Events without any causal relationship form a separate visual
  // chronology. Their order and spacing convey time only; no edges are added.
  const chronologyX = snapPosition({
    x: causalRight + (roots.length ? CHRONOLOGY_LANE_GAP : 0),
    y: 0,
  }).x;
  let chronologyTop = layoutTop;
  chronologyNodes.forEach((node) => {
    const position = snapPosition({ x: chronologyX, y: chronologyTop });
    positions.set(node.id, position);
    let actionTop = position.y;
    for (const action of actionsBySource.get(node.id) ?? []) {
      actionPositions.set(
        action.id,
        snapPosition({
          x:
            chronologyX +
            getNodeSize(node, showDetails).width +
            ACTION_HORIZONTAL_GAP,
          y: actionTop,
        }),
      );
      actionTop +=
        getNodeSize(action, showDetails).height + ACTION_VERTICAL_GAP;
    }
    chronologyTop += getNodeSize(node, showDetails).height + VERTICAL_GAP;
  });

  const causalResult = nonActionNodes.map((node) => ({
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
