import { describe, expect, it } from "vitest";
import {
  BRANCH_LANE_GAP,
  routeIncidentEdge,
  segmentIntersectsRectangle,
  type Point,
  type Rectangle,
} from "../../src/components/Canvas/IncidentEdge";

const segments = (points: Point[]) =>
  points.slice(1).map((point, index) => [points[index], point] as const);
const expectClear = (path: Point[], rectangles: Rectangle[]) => {
  for (const [start, end] of segments(path)) {
    expect(start.x === end.x || start.y === end.y).toBe(true);
    for (const rectangle of rectangles)
      expect(segmentIntersectsRectangle(start, end, rectangle)).toBe(false);
  }
};

describe("incident edge geometry", () => {
  it("separates one-to-many branch lanes", () => {
    const source = { x: 120, y: 80 };
    const left = routeIncidentEdge(
      source,
      { x: 40, y: 240 },
      { kind: "causal", obstacles: [], laneOffset: -BRANCH_LANE_GAP / 2 },
    );
    const right = routeIncidentEdge(
      source,
      { x: 200, y: 240 },
      { kind: "causal", obstacles: [], laneOffset: BRANCH_LANE_GAP / 2 },
    );
    expect(left[1].y).not.toBe(right[1].y);
    expect(Math.abs(left[1].y - right[1].y)).toBeGreaterThanOrEqual(
      BRANCH_LANE_GAP,
    );
  });

  it("detours around adjacent Controls on controlled branches", () => {
    const controls = [
      { id: "left-control", x: 30, y: 125, width: 80, height: 50 },
      { id: "right-control", x: 130, y: 125, width: 80, height: 50 },
    ];
    const path = routeIncidentEdge(
      { x: 120, y: 80 },
      { x: 120, y: 240 },
      { kind: "causal", obstacles: controls },
    );
    expectClear(path, controls);
    expect(path.length).toBeGreaterThan(2);
  });

  it("clears Chain Nodes with unequal card heights", () => {
    const cards = [
      { id: "short", x: 80, y: 115, width: 100, height: 45 },
      { id: "tall", x: 210, y: 90, width: 100, height: 130 },
    ];
    const path = routeIncidentEdge(
      { x: 130, y: 60 },
      { x: 260, y: 260 },
      { kind: "causal", obstacles: cards },
    );
    expectClear(path, cards);
  });

  it("routes Actions beside Factors without crossing an intervening causal card", () => {
    const factor = { id: "factor", x: 170, y: 70, width: 100, height: 100 };
    const path = routeIncidentEdge(
      { x: 120, y: 100 },
      { x: 340, y: 150 },
      { kind: "action", obstacles: [factor] },
    );
    expect(path[1].y).toBe(path[0].y);
    expectClear(path, [factor]);
  });
});
