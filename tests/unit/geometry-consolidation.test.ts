import { describe, expect, it } from "vitest";
import { buildLayoutGraph } from "../../src/features/layout/buildLayoutGraph";
import {
  boundsOf,
  projectInvestigationGeometry,
} from "../../src/features/layout/investigationLayout";
import { evaluateLayoutQuality } from "../../src/features/layout/layoutQuality";

describe("consolidated geometry contract", () => {
  const nodes = [
    {
      id: "impact",
      position: { x: -400, y: -200 },
      width: 240,
      height: 144,
      data: { nodeType: "Impact" as const, referenceId: "N-1" },
    },
    {
      id: "event",
      position: { x: -400, y: 80 },
      width: 240,
      height: 144,
      data: {
        nodeType: "Event" as const,
        referenceId: "N-2",
        eventDisplay: "Map" as const,
      },
    },
    {
      id: "timeline",
      position: { x: 900, y: 900 },
      width: 240,
      height: 144,
      data: {
        nodeType: "Event" as const,
        eventDisplay: "ChronologyOnly" as const,
        timestamp: "1912-04-15T00:00:00Z",
      },
    },
    {
      id: "action",
      position: { x: -100, y: 96 },
      width: 240,
      height: 112,
      data: { nodeType: "Action" as const },
    },
  ];
  const edges = [
    {
      id: "cause",
      source: "impact",
      target: "event",
      data: { kind: "CauseEffectEdge" },
    },
    {
      id: "act",
      source: "event",
      target: "action",
      data: { kind: "ActionEdge" },
    },
  ];
  const graph = buildLayoutGraph({
    nodes,
    edges,
    dimensions: (node) => ({ width: node.width!, height: node.height! }),
  });

  it("preserves ChronologyOnly and Action anchor semantics in the one adapter", () => {
    expect(
      graph.nodes.find((node) => node.id === "timeline")?.eventDisplay,
    ).toBe("ChronologyOnly");
    expect(graph.actions?.[0].attachedToId).toBe("event");
    expect(graph.chronology?.map((item) => item.nodeId)).toEqual(["timeline"]);
  });

  it("PROJECT is WYSIWYG for every persisted semantic and Action", () => {
    const committed = nodes.map((node) => ({
      id: node.id,
      role:
        node.data.nodeType === "Action"
          ? ("Action" as const)
          : ("Semantic" as const),
      rectangle: { ...node.position, width: node.width, height: node.height },
    }));
    const result = projectInvestigationGeometry(graph, committed);
    for (const node of nodes.filter((item) => item.id !== "timeline")) {
      const rendered = result.nodes.find((item) => item.id === node.id)!;
      expect({ x: rendered.rectangle.x, y: rendered.rectangle.y }).toEqual(
        node.position,
      );
    }
    expect(
      evaluateLayoutQuality(graph, result).causalBounds.width,
    ).toBeGreaterThan(0);
  });

  it("calculates actual negative-coordinate bounds without forcing zero", () => {
    expect(
      boundsOf([
        {
          id: "n",
          role: "Semantic",
          rectangle: { x: -400, y: -200, width: 240, height: 144 },
        },
      ]),
    ).toEqual({ x: -400, y: -200, width: 240, height: 144 });
    expect(boundsOf([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
