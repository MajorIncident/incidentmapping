import {
  CHAIN_NODE_HEIGHT,
  CHAIN_NODE_WIDTH,
  CONTROL_NODE_HEIGHT,
  CONTROL_NODE_WIDTH,
} from "./dimensions";
import {
  ACTION_GAP,
  ACTION_GUTTER,
  CAUSAL_ROW_GAP,
  CONTROL_BAND_HEIGHT,
  SIBLING_GAP,
} from "./geometry/spacing";
import type {
  CausalRouteRole,
  InvestigationLayoutInput,
  InvestigationLayoutOptions,
  LayoutNodeGeometry,
  LayoutResult,
  MeasuredDimensions,
  OrthogonalRoute,
  Point,
  Rectangle,
  RoutedRelationship,
} from "./layoutModel";

type PositionedSize = Readonly<{
  position: Point;
  width: number;
  height: number;
}>;

/** Layout-owned placement of an ephemeral Control projection. */
export const calculateControlPosition = (
  _source: PositionedSize,
  target: PositionedSize,
  control: MeasuredDimensions,
): Point => ({
  // The downstream port is the stable relationship lane through a merge.
  x: target.position.x + target.width / 2 - control.width / 2,
  // Rank origins, rather than individual source heights, define the band.
  y:
    target.position.y -
    (CAUSAL_ROW_GAP + CONTROL_BAND_HEIGHT) / 2 -
    control.height / 2,
});

/** Renderer-neutral edge splitting retained for thin UI adapters. */
export const splitEdgeAtControl = <
  T extends { id: string; source: string; target: string },
>(
  edge: T,
  controlId: string,
) => [
  {
    ...edge,
    id: `${edge.id}-${controlId}-upstream`,
    target: controlId,
    sourceHandle: "bottom",
    targetHandle: "top",
  },
  {
    ...edge,
    id: `${edge.id}-${controlId}-downstream`,
    source: controlId,
    sourceHandle: "bottom",
    targetHandle: "top",
  },
];

const size = (
  dimensions: MeasuredDimensions | undefined,
  fallback: MeasuredDimensions,
) => dimensions ?? fallback;
const centerTop = (rectangle: Rectangle): Point => ({
  x: rectangle.x + rectangle.width / 2,
  y: rectangle.y,
});
const centerBottom = (rectangle: Rectangle): Point => ({
  x: rectangle.x + rectangle.width / 2,
  y: rectangle.y + rectangle.height,
});
const orthogonal = (from: Point, to: Point): OrthogonalRoute => {
  const middleY = (from.y + to.y) / 2;
  return [from, { x: from.x, y: middleY }, { x: to.x, y: middleY }, to];
};
const routeRole = (outgoing: number, incoming: number): CausalRouteRole =>
  outgoing > 1 && incoming > 1
    ? "BranchAndMerge"
    : outgoing > 1
      ? "Branch"
      : incoming > 1
        ? "Merge"
        : "Direct";

/**
 * Creates a disposable graph: Controls become nodes, while branch and merge
 * junctions remain bends in route geometry. Nothing returned is a map entity.
 */
export const layoutInvestigation = async (
  input: InvestigationLayoutInput,
  options: InvestigationLayoutOptions,
): Promise<LayoutResult> => {
  const grid = options.gridSize ?? 8;
  const hGap = options.horizontalGap ?? SIBLING_GAP;
  const vGap = options.verticalGap ?? CAUSAL_ROW_GAP;
  const snap = (value: number) => Math.round(value / grid) * grid;
  const causal = input.relationships.filter((edge) => edge.kind === "Causal");
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  causal.forEach((edge) => {
    outgoing.set(edge.fromId, (outgoing.get(edge.fromId) ?? 0) + 1);
    incoming.set(edge.toId, (incoming.get(edge.toId) ?? 0) + 1);
  });

  // Rank is graph structure, never node classification or a claimed parent.
  const rank = new Map(input.nodes.map((node) => [node.id, 0]));
  const children = new Map<string, string[]>();
  const remaining = new Map(input.nodes.map((node) => [node.id, 0]));
  causal.forEach((edge) => {
    const next = children.get(edge.fromId) ?? [];
    if (!next.includes(edge.toId)) next.push(edge.toId);
    children.set(edge.fromId, next);
    remaining.set(edge.toId, (remaining.get(edge.toId) ?? 0) + 1);
  });
  const queue = input.nodes
    .filter((node) => remaining.get(node.id) === 0)
    .sort(
      (a, b) =>
        (a.layoutHints?.order ?? a.position?.x ?? 0) -
          (b.layoutHints?.order ?? b.position?.x ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .map((node) => node.id);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    for (const child of children.get(id) ?? []) {
      rank.set(child, Math.max(rank.get(child) ?? 0, (rank.get(id) ?? 0) + 1));
      const count = (remaining.get(child) ?? 1) - 1;
      remaining.set(child, count);
      if (count === 0) queue.push(child);
    }
  }
  const rankHeights = new Map<number, number>();
  input.nodes.forEach((node) => {
    const dimensions = size(node.dimensions, {
      width: CHAIN_NODE_WIDTH,
      height: CHAIN_NODE_HEIGHT,
    });
    const level = rank.get(node.id) ?? 0;
    rankHeights.set(
      level,
      Math.max(rankHeights.get(level) ?? 0, dimensions.height),
    );
  });
  const rankOrigins = new Map<number, number>();
  let origin = 0;
  [...rankHeights.keys()]
    .sort((a, b) => a - b)
    .forEach((level) => {
      rankOrigins.set(level, origin);
      origin += rankHeights.get(level)! + vGap + CONTROL_BAND_HEIGHT;
    });
  const rankOrder = new Map<number, number>();
  const geometries: LayoutNodeGeometry[] = input.nodes.map((node) => {
    const dimensions = size(node.dimensions, {
      width: CHAIN_NODE_WIDTH,
      height: CHAIN_NODE_HEIGHT,
    });
    const level = rank.get(node.id) ?? 0;
    const order = rankOrder.get(level) ?? 0;
    rankOrder.set(level, order + 1);
    const preferred = node.layoutHints?.preferredPosition ?? node.position;
    const position = {
      x:
        options.mode === "Incremental" && preferred
          ? preferred.x
          : order * (dimensions.width + hGap),
      y: rankOrigins.get(level) ?? 0,
    };
    return {
      id: node.id,
      role: "Semantic",
      rectangle: { x: snap(position.x), y: snap(position.y), ...dimensions },
    };
  });
  const byId = new Map(geometries.map((node) => [node.id, node]));

  for (const action of input.actions ?? []) {
    const anchor = byId.get(action.attachedToId);
    const dimensions = size(action.dimensions, {
      width: CHAIN_NODE_WIDTH,
      height: CHAIN_NODE_HEIGHT,
    });
    const position = action.position ?? {
      x:
        (anchor?.rectangle.x ?? 0) +
        (anchor?.rectangle.width ?? 0) +
        ACTION_GUTTER,
      y: anchor?.rectangle.y ?? 0,
    };
    const geometry: LayoutNodeGeometry = {
      id: action.id,
      role: "Action",
      rectangle: { x: snap(position.x), y: snap(position.y), ...dimensions },
    };
    geometries.push(geometry);
    byId.set(action.id, geometry);
  }

  const controlsByRelationship = new Map(
    (input.controls ?? []).map((control) => [control.relationshipId, control]),
  );
  const controlsByLane = new Map<string, LayoutNodeGeometry[]>();
  for (const edge of causal) {
    const control = controlsByRelationship.get(edge.id);
    const from = byId.get(edge.fromId);
    const to = byId.get(edge.toId);
    if (!control || !from || !to) continue;
    const dimensions = size(control.dimensions, {
      width: CONTROL_NODE_WIDTH,
      height: CONTROL_NODE_HEIGHT,
    });
    const position = calculateControlPosition(
      { position: from.rectangle, ...from.rectangle },
      { position: to.rectangle, ...to.rectangle },
      dimensions,
    );
    const geometry: LayoutNodeGeometry = {
      id: control.id,
      role: "Control",
      controlId: control.id,
      relationshipId: edge.id,
      rectangle: { x: snap(position.x), y: snap(position.y), ...dimensions },
    };
    geometries.push(geometry);
    byId.set(control.id, geometry);
    const laneKey = `${rank.get(edge.toId) ?? 0}:${to.rectangle.x + to.rectangle.width / 2}`;
    controlsByLane.set(laneKey, [
      ...(controlsByLane.get(laneKey) ?? []),
      geometry,
    ]);
  }
  controlsByLane.forEach((members) => {
    members.sort((a, b) => a.relationshipId!.localeCompare(b.relationshipId!));
    const lane = members[0].rectangle.x + members[0].rectangle.width / 2;
    const width =
      members.reduce((sum, member) => sum + member.rectangle.width, 0) +
      ACTION_GAP * Math.max(0, members.length - 1);
    let left = lane - width / 2;
    members.forEach((member) => {
      (member.rectangle as { x: number }).x = snap(left);
      left += member.rectangle.width + ACTION_GAP;
    });
  });

  const routed: RoutedRelationship[] = [];
  for (const edge of input.relationships) {
    const control = controlsByRelationship.get(edge.id);
    const stops = [edge.fromId, ...(control ? [control.id] : []), edge.toId];
    for (let index = 0; index < stops.length - 1; index += 1) {
      const from = byId.get(stops[index]);
      const to = byId.get(stops[index + 1]);
      if (!from || !to) continue;
      routed.push({
        id: stops.length > 2 ? `${edge.id}:${index}` : edge.id,
        relationshipId: edge.id,
        kind: edge.kind,
        fromId: from.id,
        toId: to.id,
        role: routeRole(
          outgoing.get(edge.fromId) ?? 0,
          incoming.get(edge.toId) ?? 0,
        ),
        route: orthogonal(
          centerBottom(from.rectangle),
          centerTop(to.rectangle),
        ),
      });
    }
  }
  const left = Math.min(0, ...geometries.map((node) => node.rectangle.x));
  const top = Math.min(0, ...geometries.map((node) => node.rectangle.y));
  const right = Math.max(
    0,
    ...geometries.map((node) => node.rectangle.x + node.rectangle.width),
  );
  const bottom = Math.max(
    0,
    ...geometries.map((node) => node.rectangle.y + node.rectangle.height),
  );
  return {
    nodes: geometries,
    relationships: routed,
    bounds: { x: left, y: top, width: right - left, height: bottom - top },
  };
};
