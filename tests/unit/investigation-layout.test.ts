import { describe, expect, it } from "vitest";
import { layoutInvestigation } from "../../src/features/layout/investigationLayout";
import type { InvestigationLayoutInput } from "../../src/features/layout/layoutModel";
import {
  ACTION_GAP,
  CARD_COLLISION_CLEARANCE,
  CONTROL_BEARING_INTERVAL,
  DIRECT_CAUSAL_EDGE_GAP,
} from "../../src/features/layout/geometry/spacing";
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
  const chain = (controlHeight?: number): InvestigationLayoutInput => ({
    nodes: [
      { id: "one", kind: "Event" },
      { id: "two", kind: "Factor" },
      { id: "three", kind: "Impact" },
    ],
    relationships: [
      { id: "one-two", kind: "Causal", fromId: "one", toId: "two" },
      { id: "two-three", kind: "Causal", fromId: "two", toId: "three" },
    ],
    ...(controlHeight === undefined
      ? {}
      : {
          controls: [
            {
              id: "control",
              kind: "Control" as const,
              relationshipId: "two-three",
              upstreamNodeId: "two",
              downstreamNodeId: "three",
              dimensions: { width: 220, height: controlHeight },
            },
          ],
        }),
  });

  it("uses the compact causal gap for every edge in a direct chain", () => {
    const result = layoutInvestigation(chain(), { mode: "ArrangeMap" });
    const nodes = ["one", "two", "three"].map(
      (id) => result.nodes.find((node) => node.id === id)!.rectangle,
    );
    expect(nodes[1].y - nodes[0].y - nodes[0].height).toBe(
      DIRECT_CAUSAL_EDGE_GAP,
    );
    expect(nodes[2].y - nodes[1].y - nodes[1].height).toBe(
      DIRECT_CAUSAL_EDGE_GAP,
    );
  });

  it("expands only the interval whose incoming edge has a Control", () => {
    const result = layoutInvestigation(chain(120), { mode: "ArrangeMap" });
    const nodes = ["one", "two", "three"].map(
      (id) => result.nodes.find((node) => node.id === id)!.rectangle,
    );
    expect(nodes[1].y - nodes[0].y - nodes[0].height).toBe(
      DIRECT_CAUSAL_EDGE_GAP,
    );
    expect(nodes[2].y - nodes[1].y - nodes[1].height).toBe(
      CONTROL_BEARING_INTERVAL,
    );
  });

  it("sizes each Control interval from its measured height", () => {
    const short = layoutInvestigation(chain(80), { mode: "ArrangeMap" });
    const tall = layoutInvestigation(chain(260), { mode: "ArrangeMap" });
    const interval = (result: typeof tall) => {
      const upstream = result.nodes.find(
        (node) => node.id === "two",
      )!.rectangle;
      const downstream = result.nodes.find(
        (node) => node.id === "three",
      )!.rectangle;
      return downstream.y - upstream.y - upstream.height;
    };
    expect(interval(short)).toBe(CONTROL_BEARING_INTERVAL);
    expect(interval(tall)).toBeGreaterThanOrEqual(
      260 + 2 * CARD_COLLISION_CLEARANCE,
    );
    const control = tall.nodes.find((node) => node.id === "control")!.rectangle;
    const upstream = tall.nodes.find((node) => node.id === "two")!.rectangle;
    const downstream = tall.nodes.find(
      (node) => node.id === "three",
    )!.rectangle;
    expect(control.y - (upstream.y + upstream.height)).toBe(
      downstream.y - (control.y + control.height),
    );
  });

  it("keeps repeated Arrange calls idempotent with a measured Control", () => {
    const input = chain(260);
    const first = layoutInvestigation(input, { mode: "ArrangeMap" });
    const second = layoutInvestigation(input, {
      mode: "ArrangeMap",
      priorGeometry: first.nodes,
    });
    expect(second.nodes).toEqual(first.nodes);
  });

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

  it("centers measured Actions and their routes on a differently sized source", () => {
    const result = layoutInvestigation(
      {
        nodes: [
          {
            id: "root",
            kind: "Event",
            dimensions: { width: 248, height: 176 },
          },
        ],
        relationships: [
          {
            id: "action-edge",
            kind: "Action",
            fromId: "root",
            toId: "action",
          },
        ],
        actions: [
          {
            id: "action",
            kind: "Action",
            attachedToId: "root",
            dimensions: { width: 232, height: 96 },
          },
        ],
      },
      { mode: "ArrangeMap" },
    );
    const root = result.nodes.find((node) => node.id === "root")!.rectangle;
    const action = result.nodes.find((node) => node.id === "action")!.rectangle;
    const route = result.relationships.find(
      (edge) => edge.id === "action-edge",
    )!.route;

    expect(action.y + action.height / 2).toBe(root.y + root.height / 2);
    expect(route.every((point) => point.y === root.y + root.height / 2)).toBe(
      true,
    );
  });

  it("centers the aggregate bounds of a measured Action stack", () => {
    const result = layoutInvestigation(
      {
        nodes: [
          {
            id: "root",
            kind: "Event",
            dimensions: { width: 240, height: 216 },
          },
        ],
        relationships: [],
        actions: [
          {
            id: "short",
            kind: "Action",
            attachedToId: "root",
            dimensions: { width: 224, height: 80 },
          },
          {
            id: "tall",
            kind: "Action",
            attachedToId: "root",
            dimensions: { width: 240, height: 112 },
          },
        ],
      },
      { mode: "ArrangeMap" },
    );
    const root = result.nodes.find((node) => node.id === "root")!.rectangle;
    const actions = ["short", "tall"].map(
      (id) => result.nodes.find((node) => node.id === id)!.rectangle,
    );
    const top = Math.min(...actions.map((action) => action.y));
    const bottom = Math.max(
      ...actions.map((action) => action.y + action.height),
    );

    expect(actions[1].y - (actions[0].y + actions[0].height)).toBe(ACTION_GAP);
    expect((top + bottom) / 2).toBe(root.y + root.height / 2);
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

  it("keeps an unequal-width one-to-one lane exact and idempotent", () => {
    const input: InvestigationLayoutInput = {
      nodes: [
        {
          id: "unrelated",
          kind: "Factor",
          dimensions: { width: 277, height: 144 },
        },
        {
          id: "parent",
          kind: "Event",
          dimensions: { width: 251, height: 144 },
        },
        {
          id: "child",
          kind: "Impact",
          dimensions: { width: 318, height: 144 },
        },
      ],
      relationships: [
        { id: "direct", kind: "Causal", fromId: "parent", toId: "child" },
      ],
    };
    const once = layoutInvestigation(input, { mode: "ArrangeMap" });
    const twice = layoutInvestigation(input, { mode: "ArrangeMap" });
    const rectangle = (result: typeof once, id: string) =>
      result.nodes.find((item) => item.id === id)!.rectangle;

    expect(rectangle(once, "parent").x + 251 / 2).toBe(
      rectangle(once, "child").x + 318 / 2,
    );
    expect(rectangle(twice, "unrelated")).toEqual(rectangle(once, "unrelated"));
    expect(twice.nodes).toEqual(once.nodes);
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
