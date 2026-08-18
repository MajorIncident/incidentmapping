import { describe, expect, it } from "vitest";
import type {
  Action,
  LayoutNodeGeometry,
  Rectangle,
} from "../../src/features/layout/layoutModel";
import {
  placeActionStacks,
  rectanglesOverlap,
} from "../../src/features/layout/routing/actionRouting";
import {
  routeOrthogonally,
  routeSegments,
  segmentIntersectsRectangle,
} from "../../src/features/layout/routing/geometry";
import { layoutInvestigation } from "../../src/features/layout/investigationLayout";
import { representativeLayoutCases } from "../fixtures/layout/cases";

describe("layout termination", () => {
  it("places four same-rank Action stacks deterministically without 2D overlap", () => {
    const sources: LayoutNodeGeometry[] = Array.from(
      { length: 4 },
      (_, index) => ({
        id: `factor-${index}`,
        role: "Semantic",
        rectangle: { x: index * 280, y: 900, width: 240, height: 140 },
      }),
    );
    const actions: Action[] = sources.map((source, index) => ({
      id: `action-${index}`,
      kind: "Action",
      attachedToId: source.id,
      dimensions: { width: 240, height: 140 },
    }));
    const bounds = { x: 0, y: 900, width: 1080, height: 140 };
    const first = placeActionStacks(actions, sources, bounds);
    expect(placeActionStacks(actions, sources, bounds)).toEqual(first);
    expect(first).toHaveLength(4);
    for (let a = 0; a < first.length; a++)
      for (let b = a + 1; b < first.length; b++)
        expect(rectanglesOverlap(first[a].rectangle, first[b].rectangle)).toBe(
          false,
        );
    expect(new Set(first.map(({ rectangle }) => rectangle.x)).size).toBe(4);
  });

  it("returns deterministic orthogonal routes through dozens of obstacles", () => {
    const obstacles: Rectangle[] = Array.from({ length: 60 }, (_, index) => ({
      x: 80 + (index % 10) * 90,
      y: 60 + Math.floor(index / 10) * 90,
      width: 50,
      height: 50 + (index % 3) * 8,
    }));
    const start = { x: 0, y: 0 };
    const end = { x: 1000, y: 650 };
    const route = routeOrthogonally(start, end, obstacles);
    expect(routeOrthogonally(start, end, obstacles)).toEqual(route);
    for (const segment of routeSegments(route)) {
      expect(
        segment.from.x === segment.to.x || segment.from.y === segment.to.y,
      ).toBe(true);
      expect(
        obstacles.some((item) =>
          segmentIntersectsRectangle(segment.from, segment.to, item),
        ),
      ).toBe(false);
    }
  });

  it("uses straight and one-bend fast paths for simple geometry", () => {
    expect(routeOrthogonally({ x: 0, y: 0 }, { x: 0, y: 100 }, [])).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 100 },
    ]);
    expect(routeOrthogonally({ x: 0, y: 0 }, { x: 100, y: 100 }, [])).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ]);
  });

  it("returns for every rich representative investigation", async () => {
    for (const fixture of Object.values(representativeLayoutCases)) {
      const result = await layoutInvestigation(fixture, { mode: "ArrangeMap" });
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.relationships.every(({ route }) => route.length >= 2)).toBe(
        true,
      );
    }
  });
}, 3_000);
