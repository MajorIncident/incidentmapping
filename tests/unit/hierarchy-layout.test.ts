import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";
import { layoutHierarchy } from "../../src/features/layout/hierarchy";
import { CHAIN_NODE_WIDTH } from "../../src/features/layout/dimensions";
import {
  hasClearance,
  legacyControlRectangle as controlRectangle,
  nodeRectangle,
  rectanglesIntersect as intersects,
} from "../helpers/layout/geometry";

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

const expectUnrelatedClearance = (
  nodes: Node[],
  controls: Array<{
    upstream: string;
    downstream: string;
    width?: number;
    height?: number;
  }>,
) => {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const objects = [
    ...nodes.map((item) => ({
      id: item.id,
      owners: new Set([item.id]),
      rectangle: nodeRectangle(item),
    })),
    ...controls.map((control, index) => ({
      id: `control-${index}`,
      owners: new Set([control.upstream, control.downstream]),
      rectangle: controlRectangle(
        byId.get(control.upstream)!,
        byId.get(control.downstream)!,
        control.width,
        control.height,
      ),
    })),
  ];
  objects.forEach((left, index) =>
    objects.slice(index + 1).forEach((right) => {
      if ([...left.owners].some((owner) => right.owners.has(owner))) return;
      expect(
        hasClearance(left.rectangle, right.rectangle),
        `${left.id} is too close to ${right.id}`,
      ).toBe(true);
    }),
  );
};

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

  it("ranks a shared descendant from every incoming causal relationship", () => {
    const cards = [
      { ...node("impact-a"), height: 144, data: { nodeType: "Impact" } },
      { ...node("impact-b"), height: 264, data: { nodeType: "Impact" } },
      { ...node("short"), height: 128, data: { classification: "KeyFactor" } },
      { ...node("long"), height: 312, data: { classification: "RootCause" } },
      { ...node("shared"), height: 176 },
    ];
    const result = layoutHierarchy(
      cards,
      [
        edge("impact-a", "short"),
        edge("impact-b", "long"),
        edge("short", "shared"),
        edge("long", "shared"),
      ],
      false,
    );
    const byId = new Map(result.map((item) => [item.id, item]));

    expect(byId.get("impact-a")!.position.y).toBe(
      byId.get("impact-b")!.position.y,
    );
    expect(byId.get("short")!.position.y).toBe(byId.get("long")!.position.y);
    expect(byId.get("shared")!.position.y).toBeGreaterThan(
      byId.get("long")!.position.y + 312,
    );
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

  it("restores exact one-to-one alignment after unequal-width measurement", () => {
    const input = [
      { ...node("parent"), width: 251 },
      { ...node("child"), width: 318 },
      { ...node("unrelated", -900), width: 273 },
    ];
    const edges = [edge("parent", "child")];
    const once = layoutHierarchy(input, edges, false);
    const byId = new Map(once.map((item) => [item.id, item]));

    expect(byId.get("parent")!.position.x + 251 / 2).toBe(
      byId.get("child")!.position.x + 318 / 2,
    );
    const beforeMeasurement = layoutHierarchy(
      input.map((item) =>
        ["parent", "child"].includes(item.id)
          ? { ...item, width: CHAIN_NODE_WIDTH }
          : item,
      ),
      edges,
      false,
    );
    expect(byId.get("unrelated")!.position).toEqual(
      beforeMeasurement.find((item) => item.id === "unrelated")!.position,
    );
    expect(positions(layoutHierarchy(once, edges, false))).toEqual(
      positions(once),
    );
  });

  it("reserves additional vertical space for details and Controls", () => {
    const nodes = [node("a"), node("b")];
    const edges = [edge("a", "b")];
    const compact = layoutHierarchy(nodes, edges, false);
    const spacious = layoutHierarchy(nodes, edges, {
      canvasDetail: "Expanded",
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
        canvasDetail: "Compact",
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
        canvasDetail: "Compact",
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

  it("centers unequal measured Action heights on their source", () => {
    const source = { ...node("root"), width: 256, height: 200 };
    const action = { ...actionNode("action"), width: 232, height: 120 };
    const result = layoutHierarchy(
      [source, action],
      [{ ...edge("root", "action"), data: { kind: "ActionEdge" } }],
      false,
    );
    const byId = new Map(result.map((item) => [item.id, item]));

    expect(byId.get("action")!.position.y + 120 / 2).toBe(
      byId.get("root")!.position.y + 200 / 2,
    );
  });

  it("centers the aggregate bounds of unequal measured Actions", () => {
    const source = { ...node("root"), width: 256, height: 216 };
    const short = { ...actionNode("short"), width: 224, height: 80 };
    const tall = { ...actionNode("tall"), width: 240, height: 112 };
    const result = layoutHierarchy(
      [source, short, tall],
      [
        { ...edge("root", "short"), data: { kind: "ActionEdge" } },
        { ...edge("root", "tall"), data: { kind: "ActionEdge" } },
      ],
      false,
    );
    const byId = new Map(result.map((item) => [item.id, item]));
    const stackTop = byId.get("short")!.position.y;
    const stackBottom = byId.get("tall")!.position.y + 112;

    expect((stackTop + stackBottom) / 2).toBe(
      byId.get("root")!.position.y + 216 / 2,
    );
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
      event: { x: 1016, y: 0, width: 240, height: 144 },
      "factor-1": { x: 0, y: 392, width: 240, height: 144 },
      "action-1": { x: 304, y: 392, width: 240, height: 144 },
      "factor-2": { x: 576, y: 392, width: 240, height: 144 },
      "action-2": { x: 880, y: 392, width: 240, height: 144 },
      "factor-3": { x: 1152, y: 392, width: 240, height: 144 },
      "action-3": { x: 1456, y: 392, width: 240, height: 144 },
      "factor-4": { x: 1728, y: 392, width: 240, height: 144 },
      "action-4": { x: 2032, y: 392, width: 240, height: 144 },
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

describe("measured content layout", () => {
  it("separates measured short and MU566-scale long cards and Controls", () => {
    const descriptions = {
      impact: "Short impact",
      event:
        "MU566 experienced a prolonged operational event while teams coordinated recovery across multiple handovers and recorded the changing conditions.",
      factor:
        "The investigation identified an extended contributing factor description covering procedure, supervision, workload, equipment condition, and communications.",
      action:
        "Revise the procedure, brief every affected team, verify competency, and audit the completed corrective work over three review cycles.",
      control:
        "The expected preventive control was not consistently available or verified at the point of work.",
    };
    const measured: Node[] = [
      {
        ...node("impact"),
        width: 252,
        height: 154,
        data: {
          nodeType: "Impact",
          description: descriptions.impact,
          evidenceIds: ["EV-1"],
        },
      },
      {
        ...eventNode("event", "2026-05-06T06:00:00Z"),
        width: 252,
        height: 318,
        data: {
          nodeType: "Event",
          timestamp: "2026-05-06T06:00:00Z",
          description: descriptions.event,
          evidenceIds: ["EV-2", "EV-3", "EV-4", "EV-5"],
        },
      },
      {
        ...node("factor"),
        width: 268,
        height: 346,
        data: {
          nodeType: "Factor",
          description: descriptions.factor,
          evidenceIds: ["EV-6", "EV-7", "EV-8"],
        },
      },
      {
        ...actionNode("action"),
        width: 260,
        height: 292,
        data: {
          nodeType: "Action",
          description: descriptions.action,
          evidenceIds: ["EV-9", "EV-10"],
        },
      },
    ];
    const edges: Edge[] = [
      edge("impact", "event"),
      edge("event", "factor"),
      { ...edge("factor", "action"), data: { kind: "ActionEdge" } },
    ];
    const result = layoutHierarchy(measured, edges, {
      canvasDetail: "Expanded",
      barrierEdges: [
        { id: "control", upstreamNodeId: "impact", downstreamNodeId: "event" },
      ],
      controlDimensions: { control: { width: 236, height: 244 } },
    });
    const rectangles = result.map((item) => ({
      id: item.id,
      rectangle: { ...item.position, width: item.width!, height: item.height! },
    }));
    rectangles.forEach((left, index) =>
      rectangles
        .slice(index + 1)
        .forEach((right) =>
          expect(
            intersects(left.rectangle, right.rectangle),
            `${left.id} overlaps ${right.id}`,
          ).toBe(false),
        ),
    );
    const byId = new Map(result.map((item) => [item.id, item]));
    const control = controlRectangle(
      byId.get("impact")!,
      byId.get("event")!,
      236,
      244,
    );
    expect(intersects(control, nodeRectangle(byId.get("impact")!))).toBe(false);
    expect(intersects(control, nodeRectangle(byId.get("event")!))).toBe(false);
  });
});

describe("visual subtree bounds", () => {
  it("separates a controlled sibling from an uncontrolled sibling", () => {
    const controls = [{ upstream: "root", downstream: "controlled" }];
    const result = layoutHierarchy(
      [node("root"), node("controlled"), node("plain")],
      [edge("root", "controlled"), edge("root", "plain")],
      {
        canvasDetail: "Compact",
        barrierEdges: controls.map(({ upstream, downstream }) => ({
          upstreamNodeId: upstream,
          downstreamNodeId: downstream,
        })),
      },
    );
    expectUnrelatedClearance(result, controls);
  });

  it("keeps Controls at consecutive levels clear of the neighboring branch", () => {
    const controls = [
      { upstream: "root", downstream: "middle" },
      { upstream: "middle", downstream: "leaf" },
    ];
    const result = layoutHierarchy(
      [node("root"), node("middle"), node("leaf"), node("sibling")],
      [edge("root", "middle"), edge("middle", "leaf"), edge("root", "sibling")],
      {
        canvasDetail: "Compact",
        barrierEdges: controls.map(({ upstream, downstream }) => ({
          upstreamNodeId: upstream,
          downstreamNodeId: downstream,
        })),
      },
    );
    expectUnrelatedClearance(result, controls);
  });

  it("reserves a controlled branch beside a measured Action column", () => {
    const controls = [{ upstream: "root", downstream: "controlled" }];
    const action = { ...actionNode("action"), width: 336, height: 264 };
    const result = layoutHierarchy(
      [node("root"), node("with-action"), action, node("controlled")],
      [
        edge("root", "with-action"),
        { ...edge("with-action", "action"), data: { kind: "ActionEdge" } },
        edge("root", "controlled"),
      ],
      {
        canvasDetail: "Compact",
        barrierEdges: controls.map(({ upstream, downstream }) => ({
          upstreamNodeId: upstream,
          downstreamNodeId: downstream,
        })),
      },
    );
    expectUnrelatedClearance(result, controls);
  });

  it("separates long detailed cards and Controls across multiple roots", () => {
    const controls = [
      { upstream: "root-a", downstream: "child-a", width: 280, height: 232 },
      { upstream: "root-b", downstream: "child-b", width: 248, height: 216 },
    ];
    const cards = [
      { ...node("root-a"), width: 344, height: 352 },
      { ...node("child-a"), width: 320, height: 384 },
      { ...node("root-b"), width: 360, height: 336 },
      { ...node("child-b"), width: 328, height: 400 },
    ];
    const result = layoutHierarchy(
      cards,
      [edge("root-a", "child-a"), edge("root-b", "child-b")],
      {
        canvasDetail: "Expanded",
        barrierEdges: controls.map(({ upstream, downstream }, index) => ({
          id: `c${index}`,
          upstreamNodeId: upstream,
          downstreamNodeId: downstream,
        })),
        controlDimensions: {
          c0: { width: 280, height: 232 },
          c1: { width: 248, height: 216 },
        },
      },
    );
    expectUnrelatedClearance(result, controls);
  });
});

describe("chronology-only layout", () => {
  it("places explicitly chronology-only connected Events in the auxiliary lane", () => {
    const nodes = [
      eventNode("impact", "2026-01-01T00:00:00Z", 0, 0),
      {
        ...eventNode("timeline", "2026-01-02T00:00:00Z", 0, 200),
        data: {
          nodeType: "Event" as const,
          timestamp: "2026-01-02T00:00:00Z",
          eventDisplay: "ChronologyOnly",
        },
      },
    ];
    const result = layoutHierarchy(
      nodes,
      [{ id: "edge", source: "impact", target: "timeline" } as Edge],
      false,
    );
    expect(
      result.find((node) => node.id === "timeline")!.position.x,
    ).toBeGreaterThan(result.find((node) => node.id === "impact")!.position.x);
  });
});
