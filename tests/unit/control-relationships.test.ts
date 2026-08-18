import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";
import { selectEligibleControlRelationships } from "../../src/state/selectors";
import type { ChainNodeData } from "../../src/state/useAppStore";

const graphNode = (
  id: string,
  referenceId: string,
  nodeType: ChainNodeData["nodeType"],
): Node<ChainNodeData> => ({
  id,
  position: { x: 0, y: 0 },
  data: { title: id, referenceId, nodeType },
});

describe("eligible Control relationships", () => {
  it("uses source-to-target direction, human references, and excludes protected edges", () => {
    const nodes = [
      graphNode("event", "N-002", "Event"),
      graphNode("factor-a", "N-004", "Factor"),
      graphNode("factor-b", "N-006", "Factor"),
    ];
    const edges: Edge[] = [
      { id: "a", source: "event", target: "factor-a" },
      { id: "b", source: "event", target: "factor-b" },
      { id: "reverse", source: "factor-a", target: "event" },
    ];
    expect(
      selectEligibleControlRelationships("event", nodes, edges, [
        { upstreamNodeId: "event", downstreamNodeId: "factor-b" },
      ]),
    ).toEqual([
      expect.objectContaining({
        upstreamNodeId: "event",
        downstreamNodeId: "factor-a",
        label: "N-002 → N-004",
      }),
    ]);
  });
});
