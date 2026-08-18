import { describe, expect, it } from "vitest";
import { layoutInvestigation } from "../../src/features/layout/investigationLayout";
import type { InvestigationLayoutInput } from "../../src/features/layout/layoutModel";

const base: InvestigationLayoutInput = {
  nodes: [
    { id: "root", kind: "Event" },
    { id: "effect", kind: "Impact" },
  ],
  relationships: [
    { id: "cause", kind: "Causal", fromId: "root", toId: "effect" },
  ],
};

describe("post-causal projections", () => {
  it("incrementally adds a Factor without moving prior geometry", async () => {
    const priorGeometry = [
      {
        id: "root",
        role: "Semantic" as const,
        rectangle: { x: 320, y: 80, width: 280, height: 160 },
      },
      {
        id: "effect",
        role: "Semantic" as const,
        rectangle: { x: 320, y: 520, width: 280, height: 160 },
      },
    ];
    const result = await layoutInvestigation(
      {
        nodes: [...base.nodes, { id: "factor", kind: "Factor" }],
        relationships: [
          ...base.relationships,
          { id: "factor-edge", kind: "Causal", fromId: "root", toId: "factor" },
        ],
      },
      {
        mode: "Incremental",
        priorGeometry,
        structuralChange: {
          kind: "AddNode",
          nodeId: "factor",
          parentId: "root",
        },
      },
    );

    for (const previous of priorGeometry) {
      expect(
        result.nodes.find((node) => node.id === previous.id)?.rectangle,
      ).toEqual(previous.rectangle);
    }
    expect(
      result.nodes.find((node) => node.id === "factor")!.rectangle.y,
    ).toBeGreaterThan(priorGeometry[0].rectangle.y);
  });

  it("places Actions to the right of their source", async () => {
    const result = await layoutInvestigation(
      {
        ...base,
        actions: [{ id: "action", kind: "Action", attachedToId: "root" }],
        relationships: [
          ...base.relationships,
          {
            id: "action-edge",
            kind: "Action",
            fromId: "root",
            toId: "action",
          },
        ],
      },
      { mode: "ArrangeMap" },
    );
    const root = result.nodes.find((node) => node.id === "root")!.rectangle;
    const action = result.nodes.find((node) => node.id === "action")!.rectangle;
    expect(action.x).toBeGreaterThan(root.x + root.width);
    expect(
      result.relationships.find((edge) => edge.id === "action-edge")?.route[0],
    ).toEqual({ x: root.x + root.width, y: root.y + root.height / 2 });
  });

  it("does not move causal nodes when an Action is added", async () => {
    const before = await layoutInvestigation(base, { mode: "ArrangeMap" });
    const after = await layoutInvestigation(
      {
        ...base,
        actions: [{ id: "action", kind: "Action", attachedToId: "root" }],
      },
      { mode: "ArrangeMap" },
    );
    for (const id of ["root", "effect"]) {
      expect(after.nodes.find((node) => node.id === id)?.rectangle).toEqual(
        before.nodes.find((node) => node.id === id)?.rectangle,
      );
    }
  });

  it("projects chronology-only Events beyond causal bounds", async () => {
    const result = await layoutInvestigation(
      {
        ...base,
        nodes: [
          ...base.nodes,
          {
            id: "chronology",
            kind: "Event",
            eventDisplay: "ChronologyOnly",
          },
        ],
        chronology: [
          { nodeId: "chronology", timestamp: "2026-01-01T00:00:00Z" },
        ],
      },
      { mode: "ArrangeMap" },
    );
    const chronology = result.nodes.find(
      (node) => node.id === "chronology",
    )!.rectangle;
    expect(chronology.x).toBeGreaterThanOrEqual(
      result.causalBounds.x + result.causalBounds.width,
    );
    expect(
      result.relationships.some(
        (edge) => edge.kind === "Causal" && edge.toId === "chronology",
      ),
    ).toBe(false);
  });
});
