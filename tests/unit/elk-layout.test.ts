import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { layoutWithElk } from "../../src/features/layout/elk/elkAdapter";
import type { LayoutGraph } from "../../src/features/layout/layoutModel";
import {
  layoutFixtureNames,
  loadLayoutFixture,
} from "../helpers/layout/fixtures";

const graphFor = (name: (typeof layoutFixtureNames)[number]): LayoutGraph => {
  const map = loadLayoutFixture(name);
  const relationships = map.edges.map((edge) => ({
    id: edge.id,
    kind:
      edge.kind === "ActionEdge" ? ("Action" as const) : ("Causal" as const),
    fromId: edge.fromId,
    toId: edge.toId,
  }));
  const actionIds = new Set(
    map.nodes
      .filter((node) => node.nodeType === "Action")
      .map((node) => node.id),
  );
  return {
    nodes: map.nodes
      .filter((node) => !actionIds.has(node.id))
      .map((node) => ({
        id: node.id,
        kind: node.nodeType as "Event" | "Factor" | "Impact",
        referenceId: node.referenceId,
        position: node.position,
      })),
    actions: map.nodes
      .filter((node) => actionIds.has(node.id))
      .map((node) => ({
        id: node.id,
        kind: "Action" as const,
        attachedToId:
          map.edges.find(
            (edge) => edge.kind === "ActionEdge" && edge.toId === node.id,
          )?.fromId ?? "",
        referenceId: node.referenceId,
        position: node.position,
      })),
    relationships,
    controls: map.barriers.flatMap((control) => {
      const edge = relationships.find(
        (candidate) =>
          candidate.kind === "Causal" &&
          candidate.fromId === control.upstreamNodeId &&
          candidate.toId === control.downstreamNodeId,
      );
      return edge
        ? [
            {
              id: control.id,
              kind: "Control" as const,
              relationshipId: edge.id,
              upstreamNodeId: control.upstreamNodeId,
              downstreamNodeId: control.downstreamNodeId,
              referenceId: control.referenceId,
            },
          ]
        : [];
    }),
  };
};

const fingerprint = (value: Awaited<ReturnType<typeof layoutWithElk>>) =>
  JSON.stringify({ nodes: value.nodes, relationships: value.relationships });

const crossingCount = (
  relationships: Awaited<ReturnType<typeof layoutWithElk>>["relationships"],
) => {
  let crossings = 0;
  relationships.forEach((left, index) =>
    relationships.slice(index + 1).forEach((right) => {
      if (
        [left.fromId, left.toId].some(
          (id) => id === right.fromId || id === right.toId,
        )
      )
        return;
      left.route.slice(0, -1).forEach((a, leftIndex) =>
        right.route.slice(0, -1).forEach((c, rightIndex) => {
          const b = left.route[leftIndex + 1];
          const d = right.route[rightIndex + 1];
          const leftVertical = a.x === b.x;
          if (leftVertical === (c.x === d.x)) return;
          const vertical = leftVertical ? [a, b] : [c, d];
          const horizontal = leftVertical ? [c, d] : [a, b];
          const x = vertical[0].x;
          const y = horizontal[0].y;
          if (
            x > Math.min(horizontal[0].x, horizontal[1].x) &&
            x < Math.max(horizontal[0].x, horizontal[1].x) &&
            y > Math.min(vertical[0].y, vertical[1].y) &&
            y < Math.max(vertical[0].y, vertical[1].y)
          )
            crossings += 1;
        }),
      );
    }),
  );
  return crossings;
};

describe("ELK fixture prototype", () => {
  it.each(layoutFixtureNames)(
    "captures deterministic metrics for %s",
    async (name) => {
      const graph = graphFor(name);
      const started = performance.now();
      const first = await layoutWithElk(graph);
      const runtimeMs = performance.now() - started;
      const second = await layoutWithElk(graph);
      const rankGroups = new Map<number, typeof first.nodes>();
      first.nodes.forEach((node) =>
        rankGroups.set(node.rectangle.y, [
          ...(rankGroups.get(node.rectangle.y) ?? []),
          node,
        ]),
      );
      const ranks = [...rankGroups]
        .map(([y, nodes]) => ({
          y,
          order: nodes
            .slice()
            .sort((a, b) => a.rectangle.x - b.rectangle.x)
            .map((node) => node.id),
        }))
        .sort((a, b) => a.y - b.y);
      const bends = first.relationships.reduce(
        (total, edge) => total + Math.max(0, edge.route.length - 2),
        0,
      );
      const metrics = {
        name,
        ranks,
        crossings: crossingCount(first.relationships),
        bends,
        dimensions: first.bounds,
        runtimeMs,
      };
      console.info("ELK prototype", JSON.stringify(metrics));
      expect(first.nodes).toHaveLength(
        graph.nodes.length +
          (graph.actions?.length ?? 0) +
          (graph.controls?.length ?? 0),
      );
      expect(first.bounds.width).toBeGreaterThan(0);
      expect(first.bounds.height).toBeGreaterThan(0);
      expect(fingerprint(first)).toBe(fingerprint(second));
    },
  );
});
