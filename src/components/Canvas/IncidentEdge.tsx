import { memo } from "react";
import { BaseEdge, type EdgeProps, type EdgeTypes } from "reactflow";
import {
  BRANCH_RAIL_GAP,
  EDGE_STUB,
} from "../../features/layout/geometry/spacing";

export type Point = { x: number; y: number };
export type Rectangle = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export const EDGE_CLEARANCE = EDGE_STUB;
export const BRANCH_LANE_GAP = BRANCH_RAIL_GAP;

const inside = (p: Point, r: Rectangle) =>
  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

export const segmentIntersectsRectangle = (
  a: Point,
  b: Point,
  r: Rectangle,
): boolean =>
  a.x === b.x
    ? a.x > r.x &&
      a.x < r.x + r.width &&
      Math.max(a.y, b.y) > r.y &&
      Math.min(a.y, b.y) < r.y + r.height
    : a.y > r.y &&
      a.y < r.y + r.height &&
      Math.max(a.x, b.x) > r.x &&
      Math.min(a.x, b.x) < r.x + r.width;

const clear = (a: Point, b: Point, obstacles: Rectangle[]) =>
  !obstacles.some((r) => segmentIntersectsRectangle(a, b, r));

/** Connects two points using the shortest path through an orthogonal visibility graph. */
const connect = (start: Point, end: Point, obstacles: Rectangle[]): Point[] => {
  if ((start.x === end.x || start.y === end.y) && clear(start, end, obstacles))
    return [start, end];
  const xs = [
    ...new Set([
      start.x,
      end.x,
      ...obstacles.flatMap((r) => [r.x, r.x + r.width]),
    ]),
  ];
  const ys = [
    ...new Set([
      start.y,
      end.y,
      ...obstacles.flatMap((r) => [r.y, r.y + r.height]),
    ]),
  ];
  const key = (p: Point) => `${p.x},${p.y}`;
  const byKey = new Map(
    xs
      .flatMap((x) => ys.map((y) => ({ x, y })))
      .filter((p) => !obstacles.some((r) => inside(p, r)))
      .map((p) => [key(p), p]),
  );
  byKey.set(key(start), start);
  byKey.set(key(end), end);
  const all = [...byKey.values()];
  const distances = new Map<string, number>([[key(start), 0]]);
  const previous = new Map<string, string>();
  const pending = new Set(byKey.keys());
  while (pending.size) {
    const currentKey = [...pending].reduce((best, candidate) =>
      (distances.get(candidate) ?? Infinity) < (distances.get(best) ?? Infinity)
        ? candidate
        : best,
    );
    pending.delete(currentKey);
    if (currentKey === key(end) || !Number.isFinite(distances.get(currentKey)))
      break;
    const current = byKey.get(currentKey)!;
    for (const next of all) {
      const nextKey = key(next);
      if (
        !pending.has(nextKey) ||
        (current.x !== next.x && current.y !== next.y) ||
        !clear(current, next, obstacles)
      )
        continue;
      const distance =
        distances.get(currentKey)! +
        Math.abs(current.x - next.x) +
        Math.abs(current.y - next.y) +
        0.01;
      if (distance < (distances.get(nextKey) ?? Infinity)) {
        distances.set(nextKey, distance);
        previous.set(nextKey, currentKey);
      }
    }
  }
  const result = [end];
  let cursor = key(end);
  while (cursor !== key(start) && previous.has(cursor)) {
    cursor = previous.get(cursor)!;
    result.unshift(byKey.get(cursor)!);
  }
  return cursor === key(start) ? result : [start, end];
};

export type EdgeRouteOptions = {
  kind: "causal" | "action";
  obstacles: Rectangle[];
  laneOffset?: number;
};

export const routeIncidentEdge = (
  source: Point,
  target: Point,
  options: EdgeRouteOptions,
): Point[] => {
  const obstacles = options.obstacles.map((r) => ({
    ...r,
    x: r.x - EDGE_CLEARANCE,
    y: r.y - EDGE_CLEARANCE,
    width: r.width + 2 * EDGE_CLEARANCE,
    height: r.height + 2 * EDGE_CLEARANCE,
  }));
  const lane =
    options.kind === "action"
      ? source.x +
        Math.max(EDGE_CLEARANCE, (target.x - source.x) / 2) +
        (options.laneOffset ?? 0)
      : (source.y + target.y) / 2 + (options.laneOffset ?? 0);
  const preferredWaypoints =
    options.kind === "action"
      ? [
          source,
          { x: source.x + EDGE_CLEARANCE, y: source.y },
          { x: lane, y: source.y },
          { x: lane, y: target.y },
          target,
        ]
      : [source, { x: source.x, y: lane }, { x: target.x, y: lane }, target];
  // A preferred gutter can itself be occupied (for example by an adjacent
  // Control). In that case let the visibility graph choose the detour rather
  // than forcing a route through the object.
  const waypoints = preferredWaypoints.filter(
    (point, index) =>
      index === 0 ||
      index === preferredWaypoints.length - 1 ||
      !obstacles.some((rectangle) => inside(point, rectangle)),
  );
  const result = [source];
  for (const waypoint of waypoints.slice(1))
    result.push(...connect(result.at(-1)!, waypoint, obstacles).slice(1));
  return result.filter(
    (point, index, points) =>
      !index ||
      index === points.length - 1 ||
      !(
        (points[index - 1].x === point.x && point.x === points[index + 1].x) ||
        (points[index - 1].y === point.y && point.y === points[index + 1].y)
      ),
  );
};

type IncidentEdgeData = {
  obstacles?: Rectangle[];
  laneOffset?: number;
  kind?: string;
  presentationRole?: string;
};
export const IncidentEdge = memo(
  (props: EdgeProps<IncidentEdgeData>): JSX.Element => {
    const points = routeIncidentEdge(
      { x: props.sourceX, y: props.sourceY },
      { x: props.targetX, y: props.targetY },
      {
        kind: props.data?.kind === "ActionEdge" ? "action" : "causal",
        obstacles: props.data?.obstacles ?? [],
        laneOffset: props.data?.laneOffset,
      },
    );
    const path = points
      .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
      .join(" ");
    return (
      <BaseEdge
        path={path}
        markerEnd={props.markerEnd}
        style={props.style}
        interactionWidth={props.interactionWidth}
      />
    );
  },
);
IncidentEdge.displayName = "IncidentEdge";
export const edgeTypes: EdgeTypes = { incident: IncidentEdge };
