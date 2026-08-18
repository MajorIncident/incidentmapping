import { EDGE_STUB, OBJECT_CLEARANCE } from "../geometry/spacing";
import type { Point, Rectangle, SharedRouteSegment } from "../layoutModel";
import { inflateRectangle, segmentIntersectsRectangle } from "./geometry";

export type RoutingEndpoint = Readonly<{
  relationshipId: string;
  sourceId: string;
  targetId: string;
  source: Point;
  target: Point;
}>;

const chooseRail = (
  preferred: number,
  minimum: number,
  maximum: number,
  left: number,
  right: number,
  obstacles: readonly Rectangle[],
): number => {
  const candidates = [
    preferred,
    minimum,
    maximum,
    ...obstacles.flatMap((r) => [r.y, r.y + r.height]),
  ].filter((y) => y >= minimum && y <= maximum);
  return [...new Set(candidates)].sort(
    (a, b) =>
      Number(
        obstacles.some((r) =>
          segmentIntersectsRectangle({ x: left, y: a }, { x: right, y: a }, r),
        ),
      ) -
        Number(
          obstacles.some((r) =>
            segmentIntersectsRectangle(
              { x: left, y: b },
              { x: right, y: b },
              r,
            ),
          ),
        ) ||
      Math.abs(a - preferred) - Math.abs(b - preferred) ||
      a - b,
  )[0];
};

export type RailGeometry = Readonly<{
  y: number;
  segment: SharedRouteSegment;
}>;

/** One source stub and horizontal rail, with each target x acting as its lane. */
export const createBranchRail = (
  sourceId: string,
  members: readonly RoutingEndpoint[],
  rectangles: readonly Rectangle[],
): RailGeometry => {
  const source = members[0].source;
  const xs = [source.x, ...members.map((member) => member.target.x)];
  const minimum = source.y + EDGE_STUB;
  const maximum = Math.max(
    minimum,
    Math.min(...members.map((m) => m.target.y - EDGE_STUB)),
  );
  const obstacles = rectangles.map((r) =>
    inflateRectangle(r, OBJECT_CLEARANCE),
  );
  const y = chooseRail(
    (minimum + maximum) / 2,
    minimum,
    maximum,
    Math.min(...xs),
    Math.max(...xs),
    obstacles,
  );
  const relationshipIds = members.map((m) => m.relationshipId).sort();
  return {
    y,
    segment: {
      id: `branch:${sourceId}`,
      kind: "BranchRail",
      from: { x: Math.min(...xs), y },
      to: { x: Math.max(...xs), y },
      relationshipIds,
    },
  };
};

/** Per-source lanes converge on one rail and a shared target stub. */
export const createMergeRail = (
  targetId: string,
  members: readonly RoutingEndpoint[],
  rectangles: readonly Rectangle[],
): RailGeometry => {
  const target = members[0].target;
  const xs = [target.x, ...members.map((member) => member.source.x)];
  const minimum = Math.min(...members.map((m) => m.source.y + EDGE_STUB));
  const maximum = target.y - EDGE_STUB;
  const obstacles = rectangles.map((r) =>
    inflateRectangle(r, OBJECT_CLEARANCE),
  );
  const y = chooseRail(
    (minimum + maximum) / 2,
    minimum,
    maximum,
    Math.min(...xs),
    Math.max(...xs),
    obstacles,
  );
  const relationshipIds = members.map((m) => m.relationshipId).sort();
  return {
    y,
    segment: {
      id: `merge:${targetId}`,
      kind: "MergeRail",
      from: { x: Math.min(...xs), y },
      to: { x: Math.max(...xs), y },
      relationshipIds,
    },
  };
};
