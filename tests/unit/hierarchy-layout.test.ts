import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";
import { layoutHierarchy } from "../../src/features/layout/hierarchy";

const node = (id: string, x = 0, y = 0): Node => ({
  id,
  type: "ChainNode",
  position: { x, y },
  data: {},
});
const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});
const positions = (nodes: Node[]) =>
  Object.fromEntries(nodes.map((item) => [item.id, item.position]));

describe("layoutHierarchy", () => {
  it("places a single tree by graph depth", () => {
    const result = layoutHierarchy(
      [node("a"), node("b"), node("c")],
      [edge("a", "b"), edge("b", "c")],
      false,
    );
    expect(result[0].position.x).toBe(result[1].position.x);
    expect(result[0].position.y).toBeLessThan(result[1].position.y);
    expect(result[1].position.y).toBeLessThan(result[2].position.y);
  });

  it("centers a parent above a branching child group", () => {
    const result = layoutHierarchy(
      [node("root"), node("left"), node("right")],
      [edge("root", "left"), edge("root", "right")],
      false,
    );
    const [root, left, right] = result;
    expect(root.position.x).toBe((left.position.x + right.position.x) / 2);
    expect(left.position.y).toBe(right.position.y);
  });

  it("places multiple roots and disconnected nodes side by side", () => {
    const result = layoutHierarchy(
      [node("a"), node("b"), node("orphan")],
      [edge("a", "b")],
      false,
    );
    expect(
      result.find((item) => item.id === "orphan")!.position.x,
    ).toBeGreaterThan(result.find((item) => item.id === "a")!.position.x);
  });

  it("terminates and positions every node in a cycle", () => {
    const result = layoutHierarchy(
      [node("a"), node("b")],
      [edge("a", "b"), edge("b", "a")],
      false,
    );
    expect(result).toHaveLength(2);
    expect(result.every((item) => Number.isFinite(item.position.x))).toBe(true);
  });

  it("is idempotent", () => {
    const input = [node("a", 17, 29), node("b", 900, 400)];
    const edges = [edge("a", "b")];
    const once = layoutHierarchy(input, edges, true);
    expect(positions(layoutHierarchy(once, edges, true))).toEqual(
      positions(once),
    );
  });

  it("reserves additional vertical space for details and barriers", () => {
    const nodes = [node("a"), node("b")];
    const edges = [edge("a", "b")];
    const compact = layoutHierarchy(nodes, edges, false);
    const spacious = layoutHierarchy(nodes, edges, {
      showDetails: true,
      barrierEdges: [{ upstreamNodeId: "a", downstreamNodeId: "b" }],
    });
    expect(spacious[1].position.y - spacious[0].position.y).toBeGreaterThan(
      compact[1].position.y - compact[0].position.y,
    );
  });
});
