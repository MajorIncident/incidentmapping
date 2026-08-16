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
const eventNode = (
  id: string,
  timestamp: string,
  x = 0,
  y = 0,
  height?: number,
): Node => ({
  ...node(id, x, y),
  height,
  data: { nodeType: "Event", timestamp },
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

  it("places isolated timestamped Events in a stable chronological lane", () => {
    const input = [
      node("root", 16, 24),
      node("cause", 16, 300),
      eventNode("later", "2025-04-03T12:00:00Z", 900, 500, 184),
      eventNode("earlier-b", "2025-04-01T08:00:00Z", 400, 200, 152),
      eventNode("earlier-a", "2025-04-01T08:00:00Z", 700, 350, 168),
    ];
    const edges = [edge("root", "cause")];
    const once = layoutHierarchy(input, edges, false);
    const byId = new Map(once.map((item) => [item.id, item]));
    const chronological = ["earlier-a", "earlier-b", "later"].map(
      (id) => byId.get(id)!,
    );

    expect(chronological.map((item) => item.position)).toEqual([
      { x: 352, y: 24 },
      { x: 352, y: 256 },
      { x: 352, y: 472 },
    ]);
    expect(new Set(chronological.map((item) => item.position.x)).size).toBe(1);
    expect(
      chronological.every(
        (item) =>
          item.position.x > byId.get("root")!.position.x + CHAIN_NODE_WIDTH,
      ),
    ).toBe(true);

    const forest = [byId.get("root")!, byId.get("cause")!];
    chronological.forEach((event) => {
      forest.forEach((cause) =>
        expect(
          intersects(
            {
              ...event.position,
              width: CHAIN_NODE_WIDTH,
              height: event.height!,
            },
            nodeRectangle(cause),
          ),
        ).toBe(false),
      );
    });
    expect(positions(layoutHierarchy(once, edges, false))).toEqual(
      positions(once),
    );
    expect(edges).toEqual([edge("root", "cause")]);
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

  it("reserves the complete footprint of sibling Factors and their Actions", () => {
    const nodes = [
      node("event"),
      node("factor-1"),
      actionNode("action-1"),
      node("factor-2"),
      actionNode("action-2"),
      node("factor-3"),
      actionNode("action-3"),
      node("factor-4"),
      actionNode("action-4"),
    ];
    const edges: Edge[] = [
      edge("event", "factor-1"),
      { ...edge("factor-1", "action-1"), data: { kind: "ActionEdge" } },
      edge("event", "factor-2"),
      { ...edge("factor-2", "action-2"), data: { kind: "ActionEdge" } },
      edge("event", "factor-3"),
      { ...edge("factor-3", "action-3"), data: { kind: "ActionEdge" } },
      edge("event", "factor-4"),
      { ...edge("factor-4", "action-4"), data: { kind: "ActionEdge" } },
    ];

    const result = layoutHierarchy(nodes, edges, false);
    const bounds = Object.fromEntries(
      result.map((item) => [item.id, nodeRectangle(item)]),
    );
    expect(bounds).toEqual({
      event: { x: 1016, y: 0, width: 240, height: 140 },
      "factor-1": { x: 0, y: 208, width: 240, height: 140 },
      "action-1": { x: 304, y: 208, width: 240, height: 140 },
      "factor-2": { x: 576, y: 208, width: 240, height: 140 },
      "action-2": { x: 880, y: 208, width: 240, height: 140 },
      "factor-3": { x: 1152, y: 208, width: 240, height: 140 },
      "action-3": { x: 1456, y: 208, width: 240, height: 140 },
      "factor-4": { x: 1728, y: 208, width: 240, height: 140 },
      "action-4": { x: 2032, y: 208, width: 240, height: 140 },
    });

    const actions = result.filter(
      (item) => (item.data as { nodeType?: string }).nodeType === "Action",
    );
    const causal = result.filter((item) => !actions.includes(item));
    actions.forEach((action, index) => {
      causal.forEach((cause) =>
        expect(intersects(nodeRectangle(action), nodeRectangle(cause))).toBe(
          false,
        ),
      );
      actions
        .slice(index + 1)
        .forEach((otherAction) =>
          expect(
            intersects(nodeRectangle(action), nodeRectangle(otherAction)),
          ).toBe(false),
        );
    });
  });
});
