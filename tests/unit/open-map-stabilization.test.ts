import { beforeEach, describe, expect, it } from "vitest";
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

  it("preserves semantic positions and requests a causal-only initial viewport", () => {
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
    expect(state.viewportRequest?.nodeIds).toEqual([
      "impact",
      "event",
      "factor-a",
      "factor-b",
    ]);
    expect(causalViewportNodeIds(state.nodes)).not.toContain("action-a");
    expect(causalViewportNodeIds(state.nodes)).not.toContain("chronology");
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
