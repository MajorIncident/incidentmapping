import type {
  InvestigationLayoutInput,
  LayoutResult,
  Point,
  Rectangle,
} from "./layoutModel";
import { routeSegments } from "./routing/geometry";

const length = (points: readonly Point[]) =>
  points
    .slice(1)
    .reduce(
      (sum, point, index) =>
        sum +
        Math.abs(point.x - points[index].x) +
        Math.abs(point.y - points[index].y),
      0,
    );
const intersects = (
  a: { from: Point; to: Point },
  b: { from: Point; to: Point },
) => {
  const av = a.from.x === a.to.x;
  const bv = b.from.x === b.to.x;
  if (av === bv) return false;
  const v = av ? a : b;
  const h = av ? b : a;
  return (
    v.from.x > Math.min(h.from.x, h.to.x) &&
    v.from.x < Math.max(h.from.x, h.to.x) &&
    h.from.y > Math.min(v.from.y, v.to.y) &&
    h.from.y < Math.max(v.from.y, v.to.y)
  );
};
export type LayoutQuality = Readonly<{
  crossings: number;
  bendCount: number;
  totalCausalEdgeLength: number;
  horizontalCausalEdgeLength: number;
  actionSourceDistance: number;
  actionRouteLength: number;
  causalBounds: Rectangle;
  sameRankAlignmentError: number;
  directChainCenterAlignmentError: number;
  sharedRailCount: number;
}>;
/** Diagnostics only: quality never authorizes movement of a healthy saved map. */
export const evaluateLayoutQuality = (
  graph: InvestigationLayoutInput,
  layout: LayoutResult,
): LayoutQuality => {
  const causal = layout.relationships.filter(
    (route) => route.kind === "Causal" && route.id === route.relationshipId,
  );
  const action = layout.relationships.filter(
    (route) => route.kind === "Action",
  );
  let crossings = 0;
  causal.forEach((route, index) =>
    causal
      .slice(index + 1)
      .forEach(
        (other) =>
          routeSegments(route.route).some((a) =>
            routeSegments(other.route).some((b) => intersects(a, b)),
          ) && crossings++,
      ),
  );
  const geometry = new Map(
    layout.nodes.map((node) => [node.id, node.rectangle]),
  );
  const actionSourceDistance = (graph.actions ?? []).reduce((sum, item) => {
    const a = geometry.get(item.id);
    const source = geometry.get(item.attachedToId);
    return (
      sum +
      (a && source
        ? Math.abs(a.x - (source.x + source.width)) +
          Math.abs(a.y + a.height / 2 - source.y - source.height / 2)
        : 0)
    );
  }, 0);
  return {
    crossings,
    bendCount: causal.reduce(
      (sum, route) => sum + Math.max(0, route.route.length - 2),
      0,
    ),
    totalCausalEdgeLength: causal.reduce(
      (sum, route) => sum + length(route.route),
      0,
    ),
    horizontalCausalEdgeLength: causal.reduce(
      (sum, route) =>
        sum +
        routeSegments(route.route)
          .filter((segment) => segment.from.y === segment.to.y)
          .reduce(
            (n, segment) => n + Math.abs(segment.to.x - segment.from.x),
            0,
          ),
      0,
    ),
    actionSourceDistance,
    actionRouteLength: action.reduce(
      (sum, route) => sum + length(route.route),
      0,
    ),
    causalBounds: layout.causalBounds,
    sameRankAlignmentError: 0,
    directChainCenterAlignmentError: 0,
    sharedRailCount: layout.sharedSegments.length,
  };
};
