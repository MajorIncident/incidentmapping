import { describe, expect, it, vi } from "vitest";
import {
  deriveGraphPresentation,
  deriveRelationshipPresentation,
  viewportAnimationDuration,
} from "../../src/components/Canvas/Canvas";

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

  it("disables fitting animation when reduced motion is requested", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    expect(viewportAnimationDuration(400)).toBe(0);
  });
});
