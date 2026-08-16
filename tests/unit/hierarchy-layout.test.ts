import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";
import { layoutHierarchy } from "../../src/features/layout/hierarchy";
import {
  CHAIN_NODE_HEIGHT,
  CHAIN_NODE_WIDTH,
  CONTROL_NODE_HEIGHT,
  CONTROL_NODE_WIDTH,
} from "../../src/features/layout/dimensions";

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
const actionNode = (id: string, x = 0, y = 0): Node => ({
  ...node(id, x, y),
  data: { nodeType: "Action" },
});
const positions = (nodes: Node[]) =>
  Object.fromEntries(nodes.map((item) => [item.id, item.position]));
type Rectangle = { x: number; y: number; width: number; height: number };
const intersects = (left: Rectangle, right: Rectangle) =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;
const controlRectangle = (upstream: Node, downstream: Node): Rectangle => ({
  x:
    (upstream.position.x +
      CHAIN_NODE_WIDTH / 2 +
      downstream.position.x +
      CHAIN_NODE_WIDTH / 2) /
      2 -
    CONTROL_NODE_WIDTH / 2,
  y:
    (upstream.position.y +
      CHAIN_NODE_HEIGHT / 2 +
      downstream.position.y +
      CHAIN_NODE_HEIGHT / 2) /
      2 -
    CONTROL_NODE_HEIGHT / 2,
  width: CONTROL_NODE_WIDTH,
  height: CONTROL_NODE_HEIGHT,
});
const nodeRectangle = (item: Node): Rectangle => ({
  ...item.position,
  width: CHAIN_NODE_WIDTH,
  height: CHAIN_NODE_HEIGHT,
});

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

  it("reserves additional vertical space for details and Controls", () => {
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

  it("separates Controls on adjacent sibling edges from each other", () => {
    const result = layoutHierarchy(
      [node("root"), node("left"), node("right")],
      [edge("root", "left"), edge("root", "right")],
      {
        showDetails: false,
        barrierEdges: [
          { upstreamNodeId: "root", downstreamNodeId: "left" },
          { upstreamNodeId: "root", downstreamNodeId: "right" },
        ],
      },
    );
    const [root, left, right] = result;
    const leftControl = controlRectangle(root, left);
    const rightControl = controlRectangle(root, right);

    expect(intersects(leftControl, rightControl)).toBe(false);
  });

  it("keeps adjacent sibling Controls clear of both edge endpoints", () => {
    const result = layoutHierarchy(
      [node("root"), node("left"), node("right")],
      [edge("root", "left"), edge("root", "right")],
      {
        showDetails: false,
        barrierEdges: [
          { upstreamNodeId: "root", downstreamNodeId: "left" },
          { upstreamNodeId: "root", downstreamNodeId: "right" },
        ],
      },
    );
    const [root, left, right] = result;

    for (const [control, endpoint] of [
      [controlRectangle(root, left), left],
      [controlRectangle(root, right), right],
    ] as const) {
      expect(intersects(control, nodeRectangle(root))).toBe(false);
      expect(intersects(control, nodeRectangle(endpoint))).toBe(false);
    }
  });

  it("places actions beside their source without changing causal coordinates", () => {
    const causal = [node("root", 16, 24), node("cause", 16, 300)];
    const causalEdge = edge("root", "cause");
    const before = layoutHierarchy(causal, [causalEdge], false);
    const actionEdge: Edge = {
      ...edge("root", "action"),
      data: { kind: "ActionEdge" },
    };
    const after = layoutHierarchy(
      [...causal, actionNode("action")],
      [causalEdge, actionEdge],
      false,
    );

    expect(positions(after.filter((item) => item.id !== "action"))).toEqual(
      positions(before),
    );
    expect(
      after.find((item) => item.id === "action")!.position.x,
    ).toBeGreaterThan(after.find((item) => item.id === "root")!.position.x);
    expect(after.find((item) => item.id === "action")!.position.x % 8).toBe(0);
  });

  it("stacks actions deterministically and remains idempotent", () => {
    const nodes = [node("root", 7, 11), actionNode("a2"), actionNode("a1")];
    const edges: Edge[] = [
      { ...edge("root", "a2"), data: { kind: "ActionEdge" } },
      { ...edge("root", "a1"), data: { kind: "ActionEdge" } },
    ];
    const once = layoutHierarchy(nodes, edges, false);
    expect(once.find((item) => item.id === "a2")!.position.y).toBeLessThan(
      once.find((item) => item.id === "a1")!.position.y,
    );
    expect(positions(layoutHierarchy(once, edges, false))).toEqual(
      positions(once),
    );
  });
});
