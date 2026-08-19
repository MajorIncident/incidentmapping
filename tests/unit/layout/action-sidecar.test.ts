import { describe, expect, it } from "vitest";
import {
  deriveActionSidecarEnvelopes,
  getExclusiveBranchMembers,
} from "../../../src/features/layout/actionSidecar";
import {
  ACTION_GAP,
  ACTION_GUTTER,
} from "../../../src/features/layout/geometry/spacing";
import { layoutInvestigation } from "../../../src/features/layout/investigationLayout";
import type {
  InvestigationLayoutInput,
  LayoutNodeGeometry,
} from "../../../src/features/layout/layoutModel";
import { rectanglesOverlap } from "../../../src/features/layout/routing/actionRouting";

const semantic = (id: string, x: number, y: number): LayoutNodeGeometry => ({
  id,
  role: "Semantic",
  rectangle: { x, y, width: 240, height: 144 },
});

describe("Action sidecar negotiation", () => {
  it("derives one envelope for the complete measured Action stack", () => {
    const [envelope] = deriveActionSidecarEnvelopes(
      [
        {
          id: "a2",
          kind: "Action",
          attachedToId: "source",
          dimensions: { width: 260, height: 80 },
        },
        {
          id: "a1",
          kind: "Action",
          attachedToId: "source",
          dimensions: { width: 220, height: 120 },
        },
      ],
      [semantic("source", 80, 160)],
    );
    expect(envelope.actionIds).toEqual(["a1", "a2"]);
    expect(envelope.requiredWidth).toBe(260);
    expect(envelope.requiredHeight).toBe(120 + ACTION_GAP + 80);
    expect(envelope.preferredRectangle.x).toBe(80 + 240 + ACTION_GUTTER);
  });

  it("stops an exclusive branch at a shared DAG descendant", () => {
    const edges = [
      { id: "pa", kind: "Causal" as const, fromId: "parent", toId: "a" },
      { id: "pb", kind: "Causal" as const, fromId: "parent", toId: "b" },
      { id: "aa", kind: "Causal" as const, fromId: "a", toId: "a2" },
      { id: "bb", kind: "Causal" as const, fromId: "b", toId: "b2" },
      { id: "am", kind: "Causal" as const, fromId: "a2", toId: "merge" },
      { id: "bm", kind: "Causal" as const, fromId: "b2", toId: "merge" },
    ];
    expect([...getExclusiveBranchMembers("b", edges)].sort()).toEqual([
      "b",
      "b2",
    ]);
  });

  it("repairs a newly added Action by shifting only its blocking branch", () => {
    const input: InvestigationLayoutInput = {
      nodes: [
        { id: "event", kind: "Event" },
        { id: "owner", kind: "Factor" },
        { id: "blocker", kind: "Factor" },
      ],
      relationships: [
        { id: "eo", kind: "Causal", fromId: "event", toId: "owner" },
        { id: "eb", kind: "Causal", fromId: "event", toId: "blocker" },
        { id: "action-edge", kind: "Action", fromId: "owner", toId: "action" },
      ],
      actions: [{ id: "action", kind: "Action", attachedToId: "owner" }],
    };
    const prior = [
      semantic("event", 0, 0),
      semantic("owner", 0, 240),
      semantic("blocker", 304, 240),
    ];
    const result = layoutInvestigation(input, {
      mode: "Incremental",
      priorGeometry: prior,
    });
    const owner = result.nodes.find((node) => node.id === "owner")!.rectangle;
    const blocker = result.nodes.find(
      (node) => node.id === "blocker",
    )!.rectangle;
    const action = result.nodes.find((node) => node.id === "action")!.rectangle;
    expect(action.x - owner.x - owner.width).toBe(ACTION_GUTTER);
    expect(blocker.x).toBeGreaterThan(304);
    expect(result.nodes.find((node) => node.id === "event")!.rectangle.x).toBe(
      0,
    );
    expect(rectanglesOverlap(action, blocker, 0)).toBe(false);
  });

  it("uses a small vertical offset before disturbing a causal branch", () => {
    const input: InvestigationLayoutInput = {
      nodes: [
        { id: "owner", kind: "Factor" },
        { id: "blocker", kind: "Factor" },
      ],
      relationships: [
        { id: "action-edge", kind: "Action", fromId: "owner", toId: "action" },
      ],
      actions: [{ id: "action", kind: "Action", attachedToId: "owner" }],
    };
    const result = layoutInvestigation(input, {
      mode: "Incremental",
      priorGeometry: [semantic("owner", 0, 0), semantic("blocker", 304, 110)],
    });
    const action = result.nodes.find((node) => node.id === "action")!.rectangle;
    const blocker = result.nodes.find(
      (node) => node.id === "blocker",
    )!.rectangle;
    expect(blocker.x).toBe(304);
    expect(action.x).toBe(304);
    expect(action.y).toBeLessThan(16);
    expect(rectanglesOverlap(action, blocker, ACTION_GAP)).toBe(false);
  });

  it("falls back to a farther gutter when branch expansion would be excessive", () => {
    const input: InvestigationLayoutInput = {
      nodes: [
        { id: "owner", kind: "Factor" },
        { id: "wide", kind: "Factor", dimensions: { width: 720, height: 144 } },
      ],
      relationships: [
        { id: "action-edge", kind: "Action", fromId: "owner", toId: "action" },
      ],
      actions: [{ id: "action", kind: "Action", attachedToId: "owner" }],
    };
    const result = layoutInvestigation(input, {
      mode: "Incremental",
      priorGeometry: [
        semantic("owner", 0, 0),
        {
          id: "wide",
          role: "Semantic",
          rectangle: { x: 200, y: -200, width: 720, height: 600 },
        },
      ],
    });
    expect(result.nodes.find((node) => node.id === "wide")!.rectangle.x).toBe(
      200,
    );
    expect(
      result.nodes.find((node) => node.id === "action")!.rectangle.x,
    ).toBeGreaterThan(920);
  });
});
