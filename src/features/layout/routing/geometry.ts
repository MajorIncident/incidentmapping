import { OBJECT_CLEARANCE } from "../geometry/spacing";
import type { OrthogonalRoute, Point, Rectangle } from "../layoutModel";

export type Segment = Readonly<{ from: Point; to: Point }>;

export const inflateRectangle = (
  rectangle: Rectangle,
  clearance = OBJECT_CLEARANCE,
): Rectangle => ({
  x: rectangle.x - clearance,
  y: rectangle.y - clearance,
  width: rectangle.width + clearance * 2,
  height: rectangle.height + clearance * 2,
});

export const pointInsideRectangle = (point: Point, rectangle: Rectangle) =>
  point.x > rectangle.x &&
  point.x < rectangle.x + rectangle.width &&
  point.y > rectangle.y &&
  point.y < rectangle.y + rectangle.height;

export const segmentIntersectsRectangle = (
  from: Point,
  to: Point,
  rectangle: Rectangle,
): boolean =>
  from.x === to.x
    ? from.x > rectangle.x &&
      from.x < rectangle.x + rectangle.width &&
      Math.max(from.y, to.y) > rectangle.y &&
      Math.min(from.y, to.y) < rectangle.y + rectangle.height
    : from.y === to.y &&
      from.y > rectangle.y &&
      from.y < rectangle.y + rectangle.height &&
      Math.max(from.x, to.x) > rectangle.x &&
      Math.min(from.x, to.x) < rectangle.x + rectangle.width;

export const simplifyOrthogonalRoute = (
  points: readonly Point[],
): OrthogonalRoute => {
  const deduplicated = points.filter(
    (point, index) =>
      !index ||
      point.x !== points[index - 1].x ||
      point.y !== points[index - 1].y,
  );
  const result = deduplicated.filter(
    (point, index) =>
      !index ||
      index === deduplicated.length - 1 ||
      !(
        (deduplicated[index - 1].x === point.x &&
          point.x === deduplicated[index + 1].x) ||
        (deduplicated[index - 1].y === point.y &&
          point.y === deduplicated[index + 1].y)
      ),
  );
  if (result.length < 2)
    throw new Error("An orthogonal route needs two points");
  return result as unknown as OrthogonalRoute;
};

const key = (point: Point) => `${point.x},${point.y}`;

/** Deterministic readability-first routing through an orthogonal visibility graph. */
export const routeOrthogonally = (
  start: Point,
  end: Point,
  rectangles: readonly Rectangle[],
): OrthogonalRoute => {
  const xs = [
    ...new Set([
      start.x,
      end.x,
      ...rectangles.flatMap((r) => [r.x, r.x + r.width]),
    ]),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set([
      start.y,
      end.y,
      ...rectangles.flatMap((r) => [r.y, r.y + r.height]),
    ]),
  ].sort((a, b) => a - b);
  const points = xs
    .flatMap((x) => ys.map((y) => ({ x, y })))
    .filter((p) => !rectangles.some((r) => pointInsideRectangle(p, r)));
  const byKey = new Map(points.map((p) => [key(p), p]));
  byKey.set(key(start), start);
  byKey.set(key(end), end);
  type State = {
    point: Point;
    direction: "H" | "V" | null;
    cost: number;
    previous?: string;
  };
  const states = new Map<string, State>();
  const pending: State[] = [{ point: start, direction: null, cost: 0 }];
  const stateKey = (p: Point, d: State["direction"]) => `${key(p)}:${d ?? "N"}`;
  while (pending.length) {
    pending.sort(
      (a, b) =>
        a.cost - b.cost ||
        key(a.point).localeCompare(key(b.point)) ||
        String(a.direction).localeCompare(String(b.direction)),
    );
    const current = pending.shift()!;
    const currentKey = stateKey(current.point, current.direction);
    if (states.has(currentKey)) continue;
    states.set(currentKey, current);
    if (key(current.point) === key(end)) {
      const route: Point[] = [end];
      let cursor = current;
      while (cursor.previous) {
        cursor = states.get(cursor.previous)!;
        route.unshift(cursor.point);
      }
      return simplifyOrthogonalRoute(route);
    }
    for (const next of byKey.values()) {
      if (
        next === current.point ||
        (next.x !== current.point.x && next.y !== current.point.y)
      )
        continue;
      if (
        rectangles.some((r) =>
          segmentIntersectsRectangle(current.point, next, r),
        )
      )
        continue;
      const direction = next.x === current.point.x ? "V" : "H";
      const distance =
        Math.abs(next.x - current.point.x) + Math.abs(next.y - current.point.y);
      // A bend is deliberately more expensive than considerable extra distance.
      const bend =
        current.direction && current.direction !== direction ? 400 : 0;
      const reverse =
        direction === "V" && next.y < current.point.y
          ? (current.point.y - next.y) * 8
          : 0;
      const horizontal = direction === "H" ? distance * 1.6 : distance;
      const proximity = rectangles.reduce(
        (score, r) =>
          score +
          (segmentIntersectsRectangle(current.point, next, {
            x: r.x - 1,
            y: r.y - 1,
            width: r.width + 2,
            height: r.height + 2,
          })
            ? 80
            : 0),
        0,
      );
      const candidate: State = {
        point: next,
        direction,
        cost:
          current.cost +
          horizontal +
          (direction === "V" ? distance : 0) +
          bend +
          reverse +
          proximity,
        previous: currentKey,
      };
      if (!states.has(stateKey(next, direction))) pending.push(candidate);
    }
  }
  return simplifyOrthogonalRoute([start, { x: start.x, y: end.y }, end]);
};

export const routeSegments = (route: readonly Point[]): Segment[] =>
  route.slice(1).map((to, index) => ({ from: route[index], to }));

export const countCrossings = (
  routes: readonly (readonly Point[])[],
): number => {
  const segments = routes.flatMap(routeSegments);
  let count = 0;
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i],
        b = segments[j];
      if (
        a.from.x === a.to.x &&
        b.from.y === b.to.y &&
        a.from.x > Math.min(b.from.x, b.to.x) &&
        a.from.x < Math.max(b.from.x, b.to.x) &&
        b.from.y > Math.min(a.from.y, a.to.y) &&
        b.from.y < Math.max(a.from.y, a.to.y)
      )
        count++;
      if (
        b.from.x === b.to.x &&
        a.from.y === a.to.y &&
        b.from.x > Math.min(a.from.x, a.to.x) &&
        b.from.x < Math.max(a.from.x, a.to.x) &&
        a.from.y > Math.min(b.from.y, b.to.y) &&
        a.from.y < Math.max(b.from.y, b.to.y)
      )
        count++;
    }
  return count;
};
