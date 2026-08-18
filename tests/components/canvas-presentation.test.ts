import { describe, expect, it, vi } from "vitest";
import {
  adaptLayoutEdgeData,
  calculateControlPosition,
  splitEdgeAtControl,
  viewportAnimationDuration,
} from "../../src/components/Canvas/Canvas";
import { layoutInvestigation } from "../../src/features/layout/investigationLayout";
import {
  deriveGraphPresentation,
  deriveRelationshipPresentation,
} from "../../src/features/presentation/selectors";

describe("Control edge geometry", () => {
  it("centers a Control in the downstream relationship lane", () => {
    const source = {
      position: { x: 40, y: 20 },
      width: 180,
      height: 100,
    };
    const target = {
      position: { x: 260, y: 420 },
      width: 300,
      height: 220,
    };
    const control = { width: 120, height: 80 };

    const position = calculateControlPosition(source, target, control);
    const center = {
      x: position.x + control.width / 2,
      y: position.y + control.height / 2,
    };
    const sourceBottom = {
      x: source.position.x + source.width / 2,
      y: source.position.y + source.height,
    };
    const targetTop = {
      x: target.position.x + target.width / 2,
      y: target.position.y,
    };

    expect(center).toEqual({
      x: targetTop.x,
      y: targetTop.y - (64 + 184) / 2,
    });
    expect(center.x).not.toBe(sourceBottom.x);
    expect(center.y).toBeGreaterThan(sourceBottom.y);
    expect(center.y).toBeLessThan(targetTop.y);
  });

  it("connects source bottom to Control top and Control bottom to target top", () => {
    const [upstream, downstream] = splitEdgeAtControl(
      { id: "causal", source: "source", target: "target" },
      "control",
    );

    expect(upstream).toMatchObject({
      source: "source",
      sourceHandle: "bottom",
      target: "control",
      targetHandle: "top",
    });
    expect(downstream).toMatchObject({
      source: "control",
      sourceHandle: "bottom",
      target: "target",
      targetHandle: "top",
    });
  });
});

describe("Canvas layout presentation adapter", () => {
  it("maps one branch rail and the common source stem from one layout result", () => {
    const layout = layoutInvestigation(
      {
        nodes: [
          { id: "source", kind: "Event", position: { x: 100, y: 0 } },
          { id: "left", kind: "Factor", position: { x: 0, y: 300 } },
          { id: "right", kind: "Factor", position: { x: 240, y: 300 } },
        ],
        relationships: [
          { id: "left-edge", kind: "Causal", fromId: "source", toId: "left" },
          { id: "right-edge", kind: "Causal", fromId: "source", toId: "right" },
        ],
      },
      { mode: "Incremental" },
    );
    const left = adaptLayoutEdgeData(
      { selected: true },
      "left-edge",
      "left-edge",
      layout,
    );
    const right = adaptLayoutEdgeData(
      { hovered: true },
      "right-edge",
      "right-edge",
      layout,
    );

    expect(left.originalEdgeId).toBe("left-edge");
    expect(right.originalEdgeId).toBe("right-edge");
    expect(left.selected).toBe(true);
    expect(right.hovered).toBe(true);
    expect([left.route?.slice(0, 2), right.route?.slice(0, 2)]).toEqual([
      left.route?.slice(0, 2),
      left.route?.slice(0, 2),
    ]);
    expect(left.sharedSegments).toHaveLength(1);
    expect(right.sharedSegments).toHaveLength(1);
    expect(left.sharedSegments[0]).toBe(right.sharedSegments[0]);
    expect(left.sharedSegments[0].from.y).toBe(left.sharedSegments[0].to.y);
  });
});

describe("deriveGraphPresentation", () => {
  const ids = ["root", "left", "left-leaf", "right"];
  const edges = [
    { source: "root", target: "left" },
    { source: "left", target: "left-leaf" },
    { source: "root", target: "right" },
  ];

  it("derives roots and leaves from graph connectivity", () => {
    const result = deriveGraphPresentation(ids, edges, null);
    expect([...result.roots]).toEqual(["root"]);
    expect([...result.leaves]).toEqual(["left-leaf", "right"]);
    expect(result.unrelated.size).toBe(0);
  });

  it("separates the selected upstream/downstream path from other branches", () => {
    const result = deriveGraphPresentation(ids, edges, "left");
    expect([...result.upstream]).toEqual(["root"]);
    expect([...result.downstream]).toEqual(["left-leaf"]);
    expect([...result.selectedPath]).toEqual(
      expect.arrayContaining(["root", "left", "left-leaf"]),
    );
    expect([...result.unrelated]).toEqual(["right"]);
  });
});

describe("presentation relationships", () => {
  const nodes = [
    { id: "impact", nodeType: "Impact" as const },
    { id: "cause", nodeType: "Factor" as const },
    { id: "other", nodeType: "Factor" as const },
    { id: "action", nodeType: "Action" as const },
  ];
  const edges = [
    { source: "impact", target: "cause" },
    { source: "impact", target: "other" },
    { source: "cause", target: "action", kind: "ActionEdge" },
  ];
  const controls = [
    { id: "control", upstreamNodeId: "impact", downstreamNodeId: "cause" },
  ];

  it("includes attached Actions in a causal relationship", () => {
    const result = deriveRelationshipPresentation(
      nodes,
      edges,
      controls,
      "cause",
    );
    expect([...result.selectedPath]).toEqual(
      expect.arrayContaining(["impact", "cause", "action", "control"]),
    );
    expect([...result.unrelated]).toContain("other");
  });

  it("resolves Action and Control selections to their causal context", () => {
    expect([
      ...deriveRelationshipPresentation(nodes, edges, controls, "action")
        .selectedPath,
    ]).toEqual(expect.arrayContaining(["impact", "cause", "action"]));
    expect([
      ...deriveRelationshipPresentation(nodes, edges, controls, "control")
        .selectedPath,
    ]).toEqual(
      expect.arrayContaining(["impact", "cause", "control", "action"]),
    );
  });

  it("starts a selected Control's downstream path at its downstream endpoint", () => {
    const branchNodes = [
      { id: "impact", nodeType: "Impact" as const },
      { id: "event", nodeType: "Event" as const },
      { id: "controlled-factor", nodeType: "Factor" as const },
      { id: "sibling-factor", nodeType: "Factor" as const },
      { id: "descendant", nodeType: "Factor" as const },
      { id: "action", nodeType: "Action" as const },
    ];
    const branchEdges = [
      { source: "impact", target: "event" },
      { source: "event", target: "controlled-factor" },
      { source: "event", target: "sibling-factor" },
      { source: "controlled-factor", target: "descendant" },
      { source: "descendant", target: "action", kind: "ActionEdge" },
    ];
    const branchControls = [
      {
        id: "branch-control",
        upstreamNodeId: "event",
        downstreamNodeId: "controlled-factor",
      },
    ];

    const result = deriveRelationshipPresentation(
      branchNodes,
      branchEdges,
      branchControls,
      "branch-control",
    );

    expect([...result.selectedPath]).toEqual(
      expect.arrayContaining([
        "impact",
        "event",
        "branch-control",
        "controlled-factor",
        "descendant",
        "action",
      ]),
    );
    expect(result.selectedPath.has("sibling-factor")).toBe(false);
    expect(result.unrelated.has("sibling-factor")).toBe(true);
  });

  it("keeps causal, Action, and branch-specific Control highlighting independent of chronology metadata", () => {
    const timedNodes = nodes.map((node, index) => ({
      ...node,
      timestamp: `2026-08-16T0${index + 8}:00:00Z`,
      eventPhase: index === 0 ? "Incident" : "Recovery",
    }));
    const baseline = deriveRelationshipPresentation(
      nodes,
      edges,
      controls,
      "control",
    );
    const chronological = deriveRelationshipPresentation(
      timedNodes,
      edges,
      controls,
      "control",
    );
    expect(chronological.selectedPath).toEqual(baseline.selectedPath);
    expect(chronological.unrelated).toEqual(baseline.unrelated);
    expect(chronological.upstream).toEqual(baseline.upstream);
    expect(chronological.downstream).toEqual(baseline.downstream);
  });

  it("disables fitting animation when reduced motion is requested", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    expect(viewportAnimationDuration(400)).toBe(0);
  });
});
