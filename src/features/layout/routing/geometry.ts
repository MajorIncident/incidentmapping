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
  if (!points.length) throw new Error("An orthogonal route needs two points");
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
  // A transient layout can legitimately collapse both ports to one coordinate.
  // Keep the route contract stable for renderers instead of turning geometry
  // simplification into a render-time exception. The health check can then
  // classify the zero-length relationship for post-load normalization.
  if (result.length < 2) {
    const start = points[0];
    return [start, points.at(-1) ?? start] as OrthogonalRoute;
  }
  return result as unknown as OrthogonalRoute;
};

const key = (point: Point) => `${point.x},${point.y}`;

const MAX_ROUTING_STATES = 12_000;
const MAX_ROUTING_EXPANSIONS = 8_000;

const segmentClear = (a: Point, b: Point, rectangles: readonly Rectangle[]) =>
  (a.x === b.x || a.y === b.y) &&
  !rectangles.some((rectangle) => segmentIntersectsRectangle(a, b, rectangle));

const clearRoute = (
  points: readonly Point[],
  rectangles: readonly Rectangle[],
) =>
  points
    .slice(1)
    .every((point, index) => segmentClear(points[index], point, rectangles));

const fallbackRoute = (
  start: Point,
  end: Point,
  rectangles: readonly Rectangle[],
): OrthogonalRoute => {
  const margin = OBJECT_CLEARANCE;
  const xs = [
    Math.min(start.x, end.x, ...rectangles.map((r) => r.x)) - margin,
    Math.max(start.x, end.x, ...rectangles.map((r) => r.x + r.width)) + margin,
  ];
  const ys = [
    Math.min(start.y, end.y, ...rectangles.map((r) => r.y)) - margin,
    Math.max(start.y, end.y, ...rectangles.map((r) => r.y + r.height)) + margin,
  ];
  const candidates = [
    ...ys.map((y) => [start, { x: start.x, y }, { x: end.x, y }, end]),
    ...xs.map((x) => [start, { x, y: start.y }, { x, y: end.y }, end]),
    ...xs.flatMap((x) =>
      ys.map((y) => [start, { x, y: start.y }, { x, y }, { x: end.x, y }, end]),
    ),
  ];
  const clear = candidates.find((candidate) =>
    clearRoute(candidate, rectangles),
  );
  return simplifyOrthogonalRoute(clear ?? candidates.at(-1)!);
};

class MinHeap<T extends { cost: number }> {
  private values: T[] = [];
  get length() {
    return this.values.length;
  }
  push(value: T) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.values[parent].cost <= value.cost) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }
  pop(): T | undefined {
    const first = this.values[0];
    const last = this.values.pop();
    if (!first || !last || !this.values.length) return first;
    let index = 0;
    while (index * 2 + 1 < this.values.length) {
      const left = index * 2 + 1;
      const right = left + 1;
      const child =
        right < this.values.length &&
        this.values[right].cost < this.values[left].cost
          ? right
          : left;
      if (this.values[child].cost >= last.cost) break;
      this.values[index] = this.values[child];
      index = child;
    }
    this.values[index] = last;
    return first;
  }
}

/** Deterministic readability-first routing through an orthogonal visibility graph. */
export const routeOrthogonally = (
  start: Point,
  end: Point,
  rectangles: readonly Rectangle[],
): OrthogonalRoute => {
  // Common connectors must never pay the visibility-graph cost.
  if (segmentClear(start, end, rectangles))
    return simplifyOrthogonalRoute([start, end]);
  const oneBends = [
    [start, { x: start.x, y: end.y }, end],
    [start, { x: end.x, y: start.y }, end],
  ];
  const oneBend = oneBends.find((route) => clearRoute(route, rectangles));
  if (oneBend) return simplifyOrthogonalRoute(oneBend);

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
  // Deterministic two-bend corridors along useful obstacle boundaries.
  const twoBends = [
    ...xs.map((x) => [start, { x, y: start.y }, { x, y: end.y }, end]),
    ...ys.map((y) => [start, { x: start.x, y }, { x: end.x, y }, end]),
  ];
  const twoBend = twoBends.find((route) => clearRoute(route, rectangles));
  if (twoBend) return simplifyOrthogonalRoute(twoBend);

  const points = xs
    .flatMap((x) => ys.map((y) => ({ x, y })))
    .filter((p) => !rectangles.some((r) => pointInsideRectangle(p, r)));
  const byKey = new Map(points.map((p) => [key(p), p]));
  byKey.set(key(start), start);
  byKey.set(key(end), end);
  const pointsByX = new Map<number, Point[]>();
  const pointsByY = new Map<number, Point[]>();
  byKey.forEach((point) => {
    pointsByX.set(point.x, [...(pointsByX.get(point.x) ?? []), point]);
    pointsByY.set(point.y, [...(pointsByY.get(point.y) ?? []), point]);
  });
  pointsByX.forEach((axis) => axis.sort((a, b) => a.y - b.y));
  pointsByY.forEach((axis) => axis.sort((a, b) => a.x - b.x));
  type State = {
    point: Point;
    direction: "H" | "V" | null;
    cost: number;
    previous?: string;
  };
  const states = new Map<string, State>();
  const pending = new MinHeap<State>();
  pending.push({ point: start, direction: null, cost: 0 });
  const best = new Map<string, number>();
  best.set(`${key(start)}:N`, 0);
  const stateKey = (p: Point, d: State["direction"]) => `${key(p)}:${d ?? "N"}`;
  let expansions = 0;
  while (pending.length && expansions++ < MAX_ROUTING_EXPANSIONS) {
    const current = pending.pop()!;
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
    // Only adjacent visible points on each axis are graph neighbours.
    const neighbours = [
      ...(pointsByX.get(current.point.x) ?? []),
      ...(pointsByY.get(current.point.y) ?? []),
    ].sort((a, b) =>
      a.x === current.point.x
        ? Math.abs(a.y - current.point.y) - Math.abs(b.y - current.point.y)
        : Math.abs(a.x - current.point.x) - Math.abs(b.x - current.point.x),
    );
    const seenDirections = new Set<string>();
    for (const next of neighbours) {
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
        cost: current.cost + horizontal + bend + reverse + proximity,
        previous: currentKey,
      };
      const directionSide = `${direction}:${direction === "V" ? Math.sign(next.y - current.point.y) : Math.sign(next.x - current.point.x)}`;
      if (seenDirections.has(directionSide)) continue;
      seenDirections.add(directionSide);
      const nextKey = stateKey(next, direction);
      if (candidate.cost >= (best.get(nextKey) ?? Infinity)) continue;
      best.set(nextKey, candidate.cost);
      if (best.size >= MAX_ROUTING_STATES) break;
      pending.push(candidate);
    }
    if (best.size >= MAX_ROUTING_STATES) break;
  }
  if (import.meta.env.DEV)
    console.warn(
      "Orthogonal routing safety limit reached; using deterministic fallback",
    );
  return fallbackRoute(start, end, rectangles);
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
