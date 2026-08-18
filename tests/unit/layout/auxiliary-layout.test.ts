import { describe, expect, it } from "vitest";
import { layoutInvestigation } from "../../../src/features/layout/investigationLayout";
import type { InvestigationLayoutInput } from "../../../src/features/layout/layoutModel";
import { ACTION_GUTTER } from "../../../src/features/layout/geometry/spacing";
import {
  geometryById,
  rectanglesIntersect,
} from "../../helpers/layout/geometry";

const input: InvestigationLayoutInput = {
  nodes: [
    { id: "root", kind: "Event", dimensions: { width: 240, height: 144 } },
    { id: "impact", kind: "Impact", dimensions: { width: 240, height: 144 } },
    {
      id: "early",
      kind: "Event",
      eventDisplay: "ChronologyOnly",
      dimensions: { width: 220, height: 96 },
    },
    {
      id: "late",
      kind: "Event",
      eventDisplay: "ChronologyOnly",
      dimensions: { width: 220, height: 128 },
    },
  ],
  relationships: [
    { id: "cause", kind: "Causal", fromId: "root", toId: "impact" },
  ],
  chronology: [
    { nodeId: "late", timestamp: "2026-08-18T12:00:00Z" },
    { nodeId: "early", timestamp: "2026-08-18T08:00:00Z" },
  ],
  actions: [
    { id: "action-b", kind: "Action", attachedToId: "root" },
    { id: "action-a", kind: "Action", attachedToId: "root" },
  ],
  controls: [
    {
      id: "control",
      kind: "Control",
      relationshipId: "cause",
      upstreamNodeId: "root",
      downstreamNodeId: "impact",
    },
  ],
};

describe("auxiliary projection invariants", () => {
  it("reserves an Action gutter and stacks multiple Actions without overlap", async () => {
    const result = await layoutInvestigation(input, { mode: "ArrangeMap" });
    const actions = result.nodes.filter((node) => node.role === "Action");
    expect(actions).toHaveLength(2);
    actions.forEach((action) =>
      expect(action.rectangle.x).toBeGreaterThanOrEqual(
        result.causalBounds.x + result.causalBounds.width + ACTION_GUTTER,
      ),
    );
    expect(
      rectanglesIntersect(actions[0].rectangle, actions[1].rectangle),
    ).toBe(false);
  });

  it("orders chronology and includes it in overall, but not causal, bounds", async () => {
    const result = await layoutInvestigation(input, { mode: "ArrangeMap" });
    const byId = geometryById(result);
    expect(byId.get("early")!.rectangle.y).toBeLessThan(
      byId.get("late")!.rectangle.y,
    );
    expect(byId.get("early")!.rectangle.x).toBeGreaterThanOrEqual(
      result.causalBounds.x + result.causalBounds.width,
    );
    expect(result.bounds.width).toBeGreaterThan(result.causalBounds.width);
  });

  it("produces byte-equivalent geometry on repeated Arrange", async () => {
    const once = await layoutInvestigation(input, { mode: "ArrangeMap" });
    const twice = await layoutInvestigation(input, {
      mode: "ArrangeMap",
      priorGeometry: once.nodes,
    });
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});
