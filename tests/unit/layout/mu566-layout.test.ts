import { describe, expect, it } from "vitest";
import { layoutInvestigation } from "../../../src/features/layout/investigationLayout";
import type { InvestigationLayoutInput } from "../../../src/features/layout/layoutModel";
import {
  geometryById,
  rectanglesIntersect,
  routeCrossesRectangle,
} from "../../helpers/layout/geometry";

const mu566: InvestigationLayoutInput = {
  nodes: [
    { id: "impact", kind: "Impact", dimensions: { width: 252, height: 154 } },
    { id: "event", kind: "Event", dimensions: { width: 252, height: 318 } },
    { id: "factor-a", kind: "Factor", dimensions: { width: 268, height: 346 } },
    { id: "factor-b", kind: "Factor", dimensions: { width: 240, height: 184 } },
    { id: "shared", kind: "Impact", dimensions: { width: 260, height: 176 } },
  ],
  relationships: [
    { id: "impact-event", kind: "Causal", fromId: "impact", toId: "event" },
    { id: "event-a", kind: "Causal", fromId: "event", toId: "factor-a" },
    { id: "event-b", kind: "Causal", fromId: "event", toId: "factor-b" },
    { id: "a-shared", kind: "Causal", fromId: "factor-a", toId: "shared" },
    { id: "b-shared", kind: "Causal", fromId: "factor-b", toId: "shared" },
    { id: "action-edge", kind: "Action", fromId: "factor-a", toId: "action" },
  ],
  controls: [
    {
      id: "control-a",
      kind: "Control",
      relationshipId: "event-a",
      upstreamNodeId: "event",
      downstreamNodeId: "factor-a",
      dimensions: { width: 236, height: 164 },
    },
    {
      id: "control-b",
      kind: "Control",
      relationshipId: "event-b",
      upstreamNodeId: "event",
      downstreamNodeId: "factor-b",
      dimensions: { width: 204, height: 132 },
    },
  ],
  actions: [
    {
      id: "action",
      kind: "Action",
      attachedToId: "factor-a",
      dimensions: { width: 260, height: 292 },
    },
  ],
};

describe("MU566 layout acceptance matrix", () => {
  it("forms causal rows, Control bands, Action gutters, clear routes, and branch/merge rails", async () => {
    const result = await layoutInvestigation(mu566, { mode: "ArrangeMap" });
    const byId = geometryById(result);
    expect(byId.get("factor-a")!.rectangle.y).toBe(
      byId.get("factor-b")!.rectangle.y,
    );
    for (const control of result.nodes.filter(
      (node) => node.role === "Control",
    )) {
      const relationship = result.relationships.find(
        (edge) => edge.id === control.relationshipId,
      )!;
      const upstream = byId.get(relationship.fromId)!.rectangle;
      const downstream = byId.get(relationship.toId)!.rectangle;
      expect(control.rectangle.y).toBeGreaterThanOrEqual(
        upstream.y + upstream.height,
      );
      expect(
        control.rectangle.y + control.rectangle.height,
      ).toBeLessThanOrEqual(downstream.y);
    }
    const action = byId.get("action")!.rectangle;
    expect(action.x).toBeGreaterThan(
      result.causalBounds.x + result.causalBounds.width,
    );
    for (const route of result.relationships) {
      const relatedIds = new Set([route.fromId, route.toId]);
      for (const obstacle of result.nodes.filter((node) => {
        if (relatedIds.has(node.id)) return false;
        if (node.role !== "Control") return true;
        const owner = mu566.controls?.find(
          (control) => control.id === node.controlId,
        );
        return (
          !owner ||
          (!relatedIds.has(owner.upstreamNodeId) &&
            !relatedIds.has(owner.downstreamNodeId))
        );
      }))
        expect(
          routeCrossesRectangle(route.route, obstacle.rectangle),
          `${route.id} crosses unrelated ${obstacle.role} ${obstacle.id}`,
        ).toBe(false);
    }
    const rails = result.sharedSegments.map((segment) => segment.kind);
    expect(rails).toContain("BranchRail");
    expect(rails).toContain("MergeRail");
    result.nodes.forEach((left, index) =>
      result.nodes
        .slice(index + 1)
        .forEach((right) =>
          expect(
            rectanglesIntersect(left.rectangle, right.rectangle),
            `${left.id} overlaps ${right.id}`,
          ).toBe(false),
        ),
    );
  });

  it("is byte-equivalent across two consecutive Arrange operations", async () => {
    const first = await layoutInvestigation(mu566, { mode: "ArrangeMap" });
    const second = await layoutInvestigation(mu566, {
      mode: "ArrangeMap",
      priorGeometry: first.nodes,
    });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
