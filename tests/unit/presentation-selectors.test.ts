import { describe, expect, it } from "vitest";
import {
  deriveHoverPresentation,
  selectLensPresentation,
  PRESENTATION_LENSES,
} from "../../src/features/presentation/selectors";
import {
  selectCaseSummary,
  CASE_SUMMARY_LIST_CAP,
} from "../../src/features/presentation/caseSummary";

const nodes = [
  {
    id: "impact",
    position: { x: 1, y: 2 },
    data: {
      title: "Injury",
      nodeType: "Impact" as const,
    },
  },
  {
    id: "cause",
    position: { x: 3, y: 4 },
    data: {
      title: "Procedure absent",
      nodeType: "Factor" as const,
      factorSignificance: "RootCause" as const,
      assertionState: "Confirmed" as const,
      evidenceIds: ["ev"],
    },
  },
  {
    id: "timeline",
    position: { x: 5, y: 6 },
    data: {
      title: "Call",
      nodeType: "Event" as const,
      eventDisplay: "ChronologyOnly" as const,
    },
  },
  {
    id: "action",
    position: { x: 7, y: 8 },
    data: {
      title: "Train",
      nodeType: "Action" as const,
      actionStatus: "Planned" as const,
      actionType: "Corrective" as const,
    },
  },
];
const controls = [
  {
    id: "control",
    kind: "Barrier" as const,
    upstreamNodeId: "impact",
    downstreamNodeId: "cause",
    description: "Checklist",
    status: "Failed" as const,
    evidenceIds: ["ev"],
  },
];
const edges = [
  { id: "a", source: "cause", target: "action", data: { kind: "ActionEdge" } },
];
const evidence = [
  {
    id: "ev",
    type: "Document" as const,
    title: "Procedure",
    attachmentIds: [],
  },
];

describe("presentation lens selectors", () => {
  for (const lens of PRESENTATION_LENSES)
    it(`derives ${lens} without graph mutation`, () => {
      const before = JSON.stringify({ nodes, edges, controls });
      const result = selectLensPresentation(lens, {
        nodes,
        edges,
        controls,
        evidence,
        selectedId: lens === "Evidence" ? "ev" : "cause",
      });
      expect(result.visibleIds).toBeInstanceOf(Set);
      expect(JSON.stringify({ nodes, edges, controls })).toBe(before);
      expect(nodes.map((node) => node.position)).toEqual([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
        { x: 7, y: 8 },
      ]);
    });

  it("applies lens-specific context", () => {
    const causal = selectLensPresentation("Causal Story", {
      nodes,
      edges,
      controls,
      evidence,
      selectedId: null,
    });
    expect(causal.visibleIds.has("timeline")).toBe(false);
    expect(causal.softenedIds.has("action")).toBe(true);
    expect(
      selectLensPresentation("Controls", {
        nodes,
        edges,
        controls,
        evidence,
        selectedId: null,
      }).counts.Failed,
    ).toBe(1);
    expect([
      ...selectLensPresentation("Evidence", {
        nodes,
        edges,
        controls,
        evidence,
        selectedId: "ev",
      }).emphasizedIds,
    ]).toEqual(["cause", "control"]);
  });
});

describe("hover presentation selector", () => {
  const causalEdges = [
    { id: "parent", source: "impact", target: "cause" },
    {
      id: "action-edge",
      source: "cause",
      target: "action",
      kind: "ActionEdge",
    },
  ];

  it("limits Control hover to the Control, endpoints, and split relationship", () => {
    const result = deriveHoverPresentation(
      nodes,
      causalEdges,
      controls,
      "control",
    );
    expect([...result.emphasizedIds]).toEqual(["control", "impact", "cause"]);
    expect([...result.emphasizedEdges]).toEqual(["parent"]);
  });

  it("includes only a causal node's direct neighborhood and attachments", () => {
    const result = deriveHoverPresentation(
      nodes,
      causalEdges,
      controls,
      "cause",
    );
    expect([...result.emphasizedIds]).toEqual(
      expect.arrayContaining(["cause", "impact", "action", "control"]),
    );
    expect([...result.emphasizedEdges]).toEqual(["parent", "action-edge"]);
  });
});

describe("case summary selector", () => {
  it("uses only explicit facts in persisted order", () => {
    const summary = selectCaseSummary(nodes, controls, evidence, []);
    expect(summary.impacts[0].label).toBe("Injury");
    expect(summary.rootCauses[0].id).toBe("cause");
    expect(summary.failedOrMissingControls[0].id).toBe("control");
    expect(summary.evidenceTypeCounts.Document).toBe(1);
    expect(summary.assertionCounts).toEqual({ Confirmed: 1, Working: 0 });
    expect(CASE_SUMMARY_LIST_CAP).toBe(5);
  });
});
