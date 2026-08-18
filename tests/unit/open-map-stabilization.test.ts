import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MapData } from "../../src/features/maps/schema";
import { emptyMap } from "../../src/features/maps/fixtures";
import {
  causalViewportNodeIds,
  useAppStore,
} from "../../src/state/useAppStore";

const node = (
  id: string,
  nodeType: "Impact" | "Event" | "Factor" | "Action",
  x: number,
  y: number,
  eventDisplay?: "Map" | "ChronologyOnly",
) => ({
  id,
  kind: "ChainNode" as const,
  referenceId: `N-${id}`,
  nodeType,
  title: id,
  evidenceIds: [],
  contextItems: [],
  position: { x, y },
  eventDisplay,
});

const richMap: MapData = {
  schemaVersion: 5,
  metadata: { title: "MU566-like", contextItems: [] },
  nodes: [
    node("impact", "Impact", 1000, 100),
    node("event", "Event", 1000, 400, "Map"),
    node("factor-a", "Factor", 850, 700),
    node("factor-b", "Factor", 1150, 700),
    node("action-a", "Action", 1600, 700),
    node("action-b", "Action", 1600, 900),
    node("chronology", "Event", -1200, 300, "ChronologyOnly"),
  ],
  edges: [
    { id: "e1", kind: "CauseEffectEdge", fromId: "event", toId: "impact" },
    { id: "e2", kind: "CauseEffectEdge", fromId: "factor-a", toId: "event" },
    { id: "e3", kind: "CauseEffectEdge", fromId: "factor-b", toId: "event" },
    { id: "a1", kind: "ActionEdge", fromId: "factor-a", toId: "action-a" },
    { id: "a2", kind: "ActionEdge", fromId: "factor-b", toId: "action-b" },
  ],
  barriers: [
    {
      id: "control",
      kind: "Barrier",
      upstreamNodeId: "event",
      downstreamNodeId: "impact",
      status: "Effective",
      referenceId: "C-001",
      evidenceIds: [],
    },
  ],
  evidence: [],
  attachments: [],
};

describe("opened-map stabilization", () => {
  beforeEach(() => useAppStore.getState().actions.newMap());

  it("preserves persisted positions while measurement is pending", () => {
    useAppStore.getState().actions.loadMap(richMap);
    const state = useAppStore.getState();
    expect(state.mapSession).toEqual({ source: "Opened", fresh: false });
    expect(
      Object.fromEntries(state.nodes.map(({ id, position }) => [id, position])),
    ).toEqual(
      Object.fromEntries(
        richMap.nodes.map(({ id, position }) => [id, position]),
      ),
    );
    expect(state.selectionId).toBe("impact");
    expect(state.barriers[0]).toMatchObject({
      upstreamNodeId: "event",
      downstreamNodeId: "impact",
    });
    expect(state.initialLayoutState).toBe("PendingMeasurement");
    expect(state.viewportRequest).toBeNull();
    expect(causalViewportNodeIds(state.nodes)).not.toContain("action-a");
    expect(causalViewportNodeIds(state.nodes)).not.toContain("chronology");
  });

  it("preserves a healthy measured map and then requests its viewport", () => {
    const healthy: MapData = {
      ...emptyMap,
      nodes: [
        node("cause", "Event", 100, 100, "Map"),
        node("impact", "Impact", 100, 500),
      ],
      edges: [
        {
          id: "edge",
          kind: "CauseEffectEdge",
          fromId: "cause",
          toId: "impact",
        },
      ],
    };
    useAppStore.getState().actions.loadMap(healthy);
    const positions = useAppStore.getState().nodes.map((item) => item.position);
    useAppStore.getState().actions.applyMeasuredLayout({
      cause: { width: 240, height: 144 },
      impact: { width: 240, height: 144 },
    });
    const state = useAppStore.getState();
    expect(state.initialLayoutState).toBe("Complete");
    expect(state.nodes.map((item) => item.position)).toEqual(positions);
    expect(state.viewportRequest?.nodeIds).toEqual(["cause", "impact"]);
    expect(state.history.past).toHaveLength(0);
  });

  it("normalizes an unhealthy measured map exactly once without undo history", async () => {
    const unhealthy: MapData = {
      ...emptyMap,
      nodes: [
        node("cause", "Event", 100, 100, "Map"),
        node("impact", "Impact", 100, 180),
      ],
      edges: [
        {
          id: "edge",
          kind: "CauseEffectEdge",
          fromId: "cause",
          toId: "impact",
        },
      ],
    };
    useAppStore.getState().actions.loadMap(unhealthy);
    useAppStore.getState().actions.applyMeasuredLayout({
      cause: { width: 280, height: 200 },
      impact: { width: 280, height: 200 },
    });
    expect(useAppStore.getState().initialLayoutState).toBe("Normalizing");
    await vi.waitFor(() =>
      expect(useAppStore.getState().initialLayoutState).toBe("Complete"),
    );
    const complete = useAppStore.getState();
    expect(complete.nodes[1].position.y).toBeGreaterThanOrEqual(232);
    expect(complete.history.past).toHaveLength(0);
    const positions = complete.nodes.map((item) => item.position);
    useAppStore.getState().actions.applyMeasuredLayout({
      cause: { width: 288, height: 208 },
      impact: { width: 288, height: 208 },
    });
    expect(useAppStore.getState().nodes.map((item) => item.position)).toEqual(
      positions,
    );
    expect(useAppStore.getState().initialLayoutState).toBe("Complete");
  });

  it("measurement updates dimensions without changing positions or refitting", () => {
    useAppStore.getState().actions.loadMap(richMap);
    const before = useAppStore.getState();
    useAppStore.getState().actions.applyMeasuredLayout({
      impact: { width: 333, height: 177 },
      control: { width: 250, height: 120 },
    });
    const after = useAppStore.getState();
    expect(after.nodes.map((item) => item.position)).toEqual(
      before.nodes.map((item) => item.position),
    );
    expect(after.viewportRequest).toEqual(before.viewportRequest);
    expect(after.measuredControlDimensions.control).toEqual({
      width: 250,
      height: 120,
    });
  });

  it("does not leave an unfulfillable viewport request for an empty map", () => {
    useAppStore.getState().actions.loadMap(emptyMap);
    expect(useAppStore.getState().viewportRequest).toBeNull();
  });
});
