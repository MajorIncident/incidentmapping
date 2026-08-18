import { describe, expect, it } from "vitest";
import { layoutInvestigation } from "../../src/features/layout/investigationLayout";
import { evaluateLayoutHealth } from "../../src/features/layout/layoutHealth";
import type { InvestigationLayoutInput } from "../../src/features/layout/layoutModel";

const controlledChain = (tight: boolean): InvestigationLayoutInput => ({
  nodes: ["n012", "n013", "n014", "n015", "n016"].map((id, index) => ({
    id,
    kind: index < 3 ? ("Event" as const) : ("Factor" as const),
    position: { x: 0, y: index * (tight ? 120 : 440) },
    dimensions: { width: 260, height: 180 },
  })),
  relationships: [
    { id: "e12", kind: "Causal", fromId: "n012", toId: "n013" },
    { id: "e13", kind: "Causal", fromId: "n013", toId: "n014" },
    { id: "e14", kind: "Causal", fromId: "n014", toId: "n015" },
    { id: "e15", kind: "Causal", fromId: "n015", toId: "n016" },
  ],
  controls: [
    {
      id: "c005",
      kind: "Control",
      relationshipId: "e13",
      upstreamNodeId: "n013",
      downstreamNodeId: "n014",
      dimensions: { width: 220, height: 152 },
    },
    {
      id: "c006",
      kind: "Control",
      relationshipId: "e14",
      upstreamNodeId: "n014",
      downstreamNodeId: "n015",
      dimensions: { width: 220, height: 152 },
    },
  ],
});

describe("post-load layout health", () => {
  it("rejects stale Titanic-like controlled geometry", () => {
    const graph = controlledChain(true);
    const layout = layoutInvestigation(graph, {
      mode: "Incremental",
      priorGeometry: graph.nodes.map((node) => ({
        id: node.id,
        role: "Semantic" as const,
        rectangle: { ...node.position!, ...node.dimensions! },
      })),
    });
    const health = evaluateLayoutHealth(graph, layout);
    expect(health.healthy).toBe(false);
    expect(
      health.issues.some((issue) => issue.kind === "SemanticOverlap"),
    ).toBe(true);
    expect(
      health.issues.some((issue) => issue.kind === "ControlClearance"),
    ).toBe(true);
  });

  it("accepts normalized measured Controls and keeps both route pieces visible", () => {
    const graph = controlledChain(false);
    const layout = layoutInvestigation(graph, { mode: "ArrangeMap" });
    expect(evaluateLayoutHealth(graph, layout)).toEqual({
      healthy: true,
      issues: [],
    });
    for (const [edge, control] of [
      ["e13", "c005"],
      ["e14", "c006"],
    ]) {
      expect(
        layout.relationships.find(
          (route) => route.id === `${edge}-${control}-upstream`,
        )!.route.length,
      ).toBeGreaterThan(1);
      expect(
        layout.relationships.find(
          (route) => route.id === `${edge}-${control}-downstream`,
        )!.route.length,
      ).toBeGreaterThan(1);
    }
    expect(
      layout.relationships.find((route) => route.id === "e15")!.route.length,
    ).toBeGreaterThan(1);
  });
});
