import { describe, expect, it } from "vitest";
import { layoutInvestigation } from "../../../src/features/layout/investigationLayout";
import type { InvestigationLayoutInput } from "../../../src/features/layout/layoutModel";
import {
  geometryById,
  rectanglesIntersect,
  routeCrossesRectangle,
  routeSegments,
} from "../../helpers/layout/geometry";

const causal = (id: string, fromId: string, toId: string) =>
  ({ id, kind: "Causal", fromId, toId }) as const;
const semantic = (id: string, kind: "Event" | "Factor" | "Impact" = "Factor") =>
  ({ id, kind, dimensions: { width: 240, height: 144 } }) as const;

const diamond: InvestigationLayoutInput = {
  nodes: [
    semantic("source", "Event"),
    semantic("left"),
    semantic("right"),
    semantic("sink", "Impact"),
  ],
  relationships: [
    causal("source-left", "source", "left"),
    causal("source-right", "source", "right"),
    causal("left-sink", "left", "sink"),
    causal("right-sink", "right", "sink"),
  ],
};

describe("engine-independent causal layout contract", () => {
  it("aligns causal depth into ranks and contains a shared descendant below every parent", async () => {
    const result = await layoutInvestigation(diamond, { mode: "ArrangeMap" });
    const byId = geometryById(result);
    expect(byId.get("left")!.rectangle.y).toBe(byId.get("right")!.rectangle.y);
    expect(byId.get("sink")!.rectangle.y).toBeGreaterThan(
      Math.max(
        ...["left", "right"].map((id) => {
          const r = byId.get(id)!.rectangle;
          return r.y + r.height;
        }),
      ),
    );
    expect(result.sharedSegments.map((segment) => segment.kind).sort()).toEqual(
      ["BranchRail", "MergeRail"],
    );
  });

  it("returns orthogonal ordered points with card-clear route segments", async () => {
    const result = await layoutInvestigation(diamond, { mode: "ArrangeMap" });
    const byId = geometryById(result);
    for (const relationship of result.relationships) {
      for (const segment of routeSegments(relationship.route))
        expect(
          segment.from.x === segment.to.x || segment.from.y === segment.to.y,
        ).toBe(true);
      for (const node of result.nodes.filter(
        (node) =>
          node.id !== relationship.fromId && node.id !== relationship.toId,
      ))
        expect(
          routeCrossesRectangle(relationship.route, node.rectangle),
          `${relationship.id} crosses ${node.id}`,
        ).toBe(false);
      expect(relationship.route[0].y).toBe(
        byId.get(relationship.fromId)!.rectangle.y +
          byId.get(relationship.fromId)!.rectangle.height,
      );
      expect(relationship.route.at(-1)!.y).toBe(
        byId.get(relationship.toId)!.rectangle.y,
      );
    }
  });

  it("places Controls in the inter-rank band without card or Control overlap", async () => {
    const input: InvestigationLayoutInput = {
      ...diamond,
      controls: [
        {
          id: "control-a",
          kind: "Control",
          relationshipId: "source-left",
          upstreamNodeId: "source",
          downstreamNodeId: "left",
        },
        {
          id: "control-b",
          kind: "Control",
          relationshipId: "source-right",
          upstreamNodeId: "source",
          downstreamNodeId: "right",
        },
      ],
    };
    const result = await layoutInvestigation(input, { mode: "ArrangeMap" });
    const controls = result.nodes.filter((node) => node.role === "Control");
    expect(controls).toHaveLength(2);
    controls.forEach((control) => {
      result.nodes
        .filter((node) => node.role === "Semantic")
        .forEach((card) =>
          expect(rectanglesIntersect(control.rectangle, card.rectangle)).toBe(
            false,
          ),
        );
    });
    expect(
      rectanglesIntersect(controls[0].rectangle, controls[1].rectangle),
    ).toBe(false);
  });

  it("keeps multiple Impacts stable regardless of input ordering", async () => {
    const input: InvestigationLayoutInput = {
      nodes: [
        semantic("impact-b", "Impact"),
        semantic("root", "Event"),
        semantic("impact-a", "Impact"),
      ],
      relationships: [
        causal("b", "root", "impact-b"),
        causal("a", "root", "impact-a"),
      ],
    };
    const first = await layoutInvestigation(input, { mode: "ArrangeMap" });
    const reordered = await layoutInvestigation(
      {
        ...input,
        nodes: [...input.nodes].reverse(),
        relationships: [...input.relationships].reverse(),
      },
      { mode: "ArrangeMap" },
    );
    const normalized = (result: typeof first) =>
      result.nodes
        .map(({ id, rectangle }) => ({ id, rectangle }))
        .sort((a, b) => a.id.localeCompare(b.id));
    expect(normalized(reordered)).toEqual(normalized(first));
  });
});
