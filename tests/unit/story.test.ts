import { describe, expect, it } from "vitest";
import type { Node } from "reactflow";
import type { ChainNodeData } from "../../src/state/useAppStore";
import { deriveStorySequence } from "../../src/features/presentation/story";

const node = (
  id: string,
  referenceId: string,
  nodeType: ChainNodeData["nodeType"],
  significance?: ChainNodeData["factorSignificance"],
): Node<ChainNodeData> => ({
  id,
  type: "ChainNode",
  position: { x: 0, y: 0 },
  data: {
    title: id,
    referenceId,
    nodeType,
    factorSignificance: significance,
    evidenceIds: [],
  },
});
const nodes = [
  node("impact", "N-001", "Impact"),
  node("event", "N-002", "Event"),
  node("key", "N-003", "Factor", "KeyFactor"),
  node("root", "N-004", "Factor", "RootCause"),
  node("action", "N-005", "Action"),
];
const edges = [
  {
    id: "1",
    source: "impact",
    target: "event",
    data: { kind: "CauseEffectEdge" },
  },
  {
    id: "2",
    source: "event",
    target: "root",
    data: { kind: "CauseEffectEdge" },
  },
  {
    id: "3",
    source: "event",
    target: "key",
    data: { kind: "CauseEffectEdge" },
  },
  { id: "4", source: "root", target: "action", data: { kind: "ActionEdge" } },
];
const input = {
  nodes,
  edges,
  controls: [
    {
      id: "control",
      referenceId: "C-001",
      upstreamNodeId: "event",
      downstreamNodeId: "root",
      status: "Failed",
      description: "check",
    },
  ],
  evidence: [],
};

describe("deriveStorySequence", () => {
  it("starts from a selected major finding", () => {
    const result = deriveStorySequence(input, "root");
    expect(result.branchCount).toBe(1);
    expect(result.steps.map((step) => step.type)).toEqual([
      "Impact",
      "Incident Event",
      "Control",
      "Root Cause",
      "Action",
    ]);
  });
  it("presents multiple findings without duplicating their shared path", () => {
    const result = deriveStorySequence(input);
    expect(result.branchCount).toBe(2);
    expect(
      result.steps.filter((step) => step.entityId === "impact"),
    ).toHaveLength(1);
    expect(
      new Set(
        result.steps
          .filter((step) => ["Key Factor", "Root Cause"].includes(step.type))
          .map((step) => step.branch),
      ).size,
    ).toBe(2);
  });
  it("retains findings when optional controls, actions, and evidence are missing", () => {
    expect(
      deriveStorySequence(
        { ...input, edges: edges.slice(0, 3), controls: [] },
        "root",
      ).steps.at(-1)?.type,
    ).toBe("Root Cause");
  });
  it("uses reference IDs as deterministic branch tie-breakers", () => {
    const reordered = deriveStorySequence({
      ...input,
      nodes: [...nodes].reverse(),
      edges: [...edges].reverse(),
    });
    expect(
      reordered.steps
        .filter((step) => step.type.includes("Factor"))
        .map((step) => step.entityId),
    ).toEqual(["key"]);
    expect(
      reordered.steps.find((step) => step.type === "Root Cause")?.branch,
    ).toBe(2);
  });
});
