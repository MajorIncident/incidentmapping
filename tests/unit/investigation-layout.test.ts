import { describe, expect, it } from "vitest";
import { layoutInvestigation } from "../../src/features/layout/investigationLayout";
import type { InvestigationLayoutInput } from "../../src/features/layout/layoutModel";
import { loadLayoutFixture } from "../helpers/layout/fixtures";

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
  it("routes controlled siblings on the semantic branch rail and vertically through each Control", () => {
    const fixture = loadLayoutFixture("controlled-siblings-with-descendants");
    const relationships = fixture.edges.map((edge) => ({
      id: edge.id,
      kind: "Causal" as const,
      fromId: edge.fromId,
      toId: edge.toId,
    }));
    const result = layoutInvestigation(
      {
        nodes: fixture.nodes.map((node) => ({
          id: node.id,
          kind: node.nodeType === "Action" ? "Factor" : node.nodeType,
        })),
        relationships,
        controls: fixture.barriers.map((control) => ({
          id: control.id,
          kind: "Control" as const,
          relationshipId: relationships.find(
            (edge) =>
              edge.fromId === control.upstreamNodeId &&
              edge.toId === control.downstreamNodeId,
          )!.id,
          upstreamNodeId: control.upstreamNodeId,
          downstreamNodeId: control.downstreamNodeId,
        })),
      },
      { mode: "ArrangeMap" },
    );
    const controlled = result.relationships.filter((edge) =>
      ["cause-1", "cause-2"].includes(edge.id),
    );
    expect(controlled).toHaveLength(2);
    expect(
      new Set(controlled.map((edge) => JSON.stringify(edge.route.slice(0, 2)))),
    ).toHaveLength(1);
    const rail = result.sharedSegments.find(
      (segment) => segment.kind === "BranchRail",
    )!;
    expect(rail.relationshipIds).toEqual(["cause-1", "cause-2"]);
    expect(rail.from.y).toBe(rail.to.y);
    for (const edge of controlled) {
      const control = result.nodes.find(
        (node) => node.relationshipId === edge.id,
      )!.rectangle;
      const center = control.x + control.width / 2;
      const top = edge.route.findIndex(
        (point) => point.x === center && point.y === control.y,
      );
      const bottom = edge.route.findIndex(
        (point) => point.x === center && point.y === control.y + control.height,
      );
      expect(top).toBeGreaterThan(0);
      expect(bottom).toBe(top + 1);
      expect(edge.route[top - 1].x).toBe(center);
      expect(edge.route[bottom + 1].x).toBe(center);
    }
  });

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
