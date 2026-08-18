import { describe, expect, it } from "vitest";
import type {
  CausalRelationship,
  LayoutNodeGeometry,
  Point,
} from "../../src/features/layout/layoutModel";
import { OBJECT_CLEARANCE } from "../../src/features/layout/geometry/spacing";
import {
  classifyCausalRelationship,
  routeCausalRelationships,
} from "../../src/features/layout/routing/causalRouting";
import {
  countCrossings,
  inflateRectangle,
  routeSegments,
  segmentIntersectsRectangle,
} from "../../src/features/layout/routing/geometry";

const node = (id: string, x: number, y: number): LayoutNodeGeometry => ({
  id,
  role: "Semantic",
  rectangle: { x, y, width: 100, height: 60 },
});
const edge = (
  id: string,
  fromId: string,
  toId: string,
): CausalRelationship => ({ id, kind: "Causal", fromId, toId });
const vertical = (a: Point, b: Point) => a.x === b.x && a.y !== b.y;

describe("causal routing", () => {
  it("classifies relationships solely from graph degree", () => {
    expect(classifyCausalRelationship(1, 1)).toBe("Direct");
    expect(classifyCausalRelationship(2, 1)).toBe("Branch");
    expect(classifyCausalRelationship(1, 2)).toBe("Merge");
    expect(classifyCausalRelationship(2, 2)).toBe("BranchAndMerge");
  });

  it("shares rails while retaining vertical, orthogonal ports deterministically", () => {
    const nodes = [
      node("source", 100, 0),
      node("left", 0, 300),
      node("right", 240, 300),
    ];
    const edges = [edge("a", "source", "left"), edge("b", "source", "right")];
    const first = routeCausalRelationships(edges, nodes);
    expect(routeCausalRelationships(edges, nodes)).toEqual(first);
    expect(first.sharedSegments).toHaveLength(1);
    expect(first.sharedSegments[0].relationshipIds).toEqual(["a", "b"]);
    for (const relationship of first.relationships) {
      expect(vertical(relationship.route[0], relationship.route[1])).toBe(true);
      expect(
        vertical(relationship.route.at(-2)!, relationship.route.at(-1)!),
      ).toBe(true);
      for (const { from, to } of routeSegments(relationship.route))
        expect(from.x === to.x || from.y === to.y).toBe(true);
    }
    expect(countCrossings(first.relationships.map((item) => item.route))).toBe(
      0,
    );
  });

  it("keeps a direct route outside unrelated cards and their clearance", () => {
    const obstacle = node("control", 110, 125);
    const result = routeCausalRelationships(
      [edge("relationship", "source", "target")],
      [
        node("source", 60, 0),
        node("target", 180, 320),
        { ...obstacle, role: "Control" },
      ],
    );
    const inflated = inflateRectangle(obstacle.rectangle, OBJECT_CLEARANCE);
    for (const segment of routeSegments(result.relationships[0].route))
      expect(
        segmentIntersectsRectangle(segment.from, segment.to, inflated),
      ).toBe(false);
  });
});
